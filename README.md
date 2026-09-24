# SpaceX Vehicle Center

Experiencia 3D interactiva, a escala real (1 unidad = 1 metro), con recreaciones técnicas de ocho expositores de SpaceX:

| Vehículo | Configuración modelada | Altura / envergadura |
|---|---|---|
| Falcon 1 | Configuración tardía de 2008: Merlin 1C, Kestrel y cofia bicónica; corte educativo de la segunda etapa | 21,336 m · 1,6764 m de diámetro |
| Starship + Super Heavy | Versión 3 (Block 3): 33 Raptor 3, 3 grid fins con pines de captura integrados, sección hot-staging ventilada | 124 m |
| Falcon 9 | Block 5 con cofia de 5,2 m, patas plegadas, grid fins de titanio | 70 m |
| Falcon Heavy | Tres núcleos, propulsores laterales con cono de morro | 70 m · 12,2 m de ancho |
| Dragon | Crew Dragon con trunk (paneles solares en media circunferencia, radiadores, aletas) | 8,1 m |
| Starlink | V2 Mini con las dos alas solares desplegadas | 30 m de envergadura |
| Tesla Roadster | 1.ª generación (modelo 2010, carrocería anterior al 2.5) con Starman, carga útil del vuelo inaugural del Falcon Heavy | 3,947 m · 1,852 m de ancho · 1,128 m de alto |
| Engine Row | Raptor 3, Raptor Vacuum y Merlin 1D sobre cunas, a 1:1 | 4,4 m (RVac) |

Los expositores siguen el orden cronológico del programa: el **Falcon 1** abre la fila (tecla **1** y primera parada del plano y del recorrido).

Starship no está sobre un soporte de museo sino sobre su plataforma: una reconstrucción a escala del **Pad 2 de Starbase** — la explanada, la zanja de llamas bidireccional revestida de inoxidable con su deflector central, la mesa de lanzamiento cuadrada de cubierta refrigerada por agua con sus veinte pinzas de sujeción, las conexiones separadas de metano y oxígeno del propulsor con su búnker dividido, la torre de integración de 144,5 m, los brazos de captura de 36 m, el brazo de desconexión rápida de la nave, el pararrayos y la estación meteorológica en lo alto de la torre, el depósito de agua del deluge en tanques horizontales y la granja criogénica con sus tanques horizontales de oxígeno y metano y los subenfriadores. Los tres Falcon tampoco: **están de pie como en la plataforma**, sobre sus pinzas de sujeción y con los motores colgando libres sobre una abertura de la mesa. Antes descansaban con las toberas sobre un anillo más ancho que el propio cohete y, vistos de lado, flotaban. Lo citado (blog de NASA Commercial Crew sobre la adaptación de la plataforma 39A, 2016; Spaceflight Now, 2019): el Falcon 9 lo sujetan **cuatro pinzas** en los puntos cardinales y el Falcon Heavy **ocho**, porque el par este-oeste del Falcon 9 caería donde están los motores de los laterales; el peso del cohete descansa sobre las pinzas y no sobre los motores, y el TEL del Heavy lleva **seis mástiles de servicio de cola** que alimentan los tres núcleos por placas umbilicales en la base. Cada mesa es un bloque de hormigón con cubierta de acero, un túnel de escape que lo atraviesa con un deflector de dos vertientes bajo la abertura, barandilla y escalera; las pinzas (placa base, pedestal, asiento bajo el borde de la base, dedo de retención y cilindro hidráulico) sostienen el borde inferior de la etapa. El reparto de las ocho del Heavy —dos en el núcleo central y tres en cada lateral—, el bloque, el túnel, los mástiles y sus posiciones están reconstruidos. El **Falcon 1** se apoya en el canto inferior de su cola troncocónica y tiene al lado el equipo de tierra que se ve en las fotos de Omelek: un **erector** de celosía blanca con dos brazos que abrazan la etapa y una **torre umbilical** triangular con su pluma, de la que baja en bucle la manguera a la segunda etapa y otra más fina a la primera (todo reconstruido de fotografías; nada de ello tiene cotas publicadas). Starship, en cambio, se sostiene como en Starbase: la mesa de lanzamiento del Pad 2 lo agarra por el faldón con sus veinte pinzas.

Desde ahí **despega**: con **G** o el botón *Launch* corre la secuencia completa, de la cuenta atrás a la separación en caliente — y después **el propulsor vuelve y la torre lo atrapa**, con el ciclo de boostback, el descenso, el encendido de aterrizaje y los brazos cerrándose sobre él.

Todo el modelo es procedural (sin binarios): las geometrías se generan a partir de perfiles de revolución con normales analíticas y UV métricas, los materiales PBR usan texturas generadas en Canvas (acero laminado con soldadura de anillo cada 1,83 m y costura vertical de placa cada 7,3 m, asfalto envejecido con sellado de grietas, composite de carbono, células solares, PICA, hormigón en losas de 6 m, oleaje) y el escudo térmico de Starship son 13 132 losetas hexagonales instanciadas de 0,26 m entre caras sobre la mitad expuesta del casco, el morro y las aletas.

Los acabados están calibrados contra fotografías del vehículo real: el acero inoxidable es **mate**, no espejo, y muestra las dos direcciones de soldadura; las losetas forman un **mosaico de gris carbón con variación en manchas** — no ruido por loseta, que se lee como escamas de pez — y no proyectan sombra sobre sí mismas; y las aletas son **oscuras por ambas caras**, con la de barlovento texturada. En los Falcon, las **grid fins de titanio** son gris carbón (antes, un titanio claro y pulido reflejaba el cielo y se leía como una celosía de plástico blanco), el **interior de las toberas** es oscuro y mate en lugar de metal desnudo, y las **patas plegadas** envuelven el tanque con sección abombada en vez de ser placas planas separadas 8 cm de él en los bordes. El **fuselaje del Falcon 9 y del Falcon Heavy es blanco limpio**, como un cohete nuevo en la plataforma: el hollín en vetas de un propulsor reutilizado se leía en la exposición como un acabado quemado y sucio (el patrón sigue disponible en la textura, desactivado). Las **células solares del trunk de la Dragon** son casi negras con líneas plateadas finas, no la rejilla azul saturada que mostraban. La manta térmica blanca del bus del **Starlink** conserva un arrugado suave; con normales exageradas y barniz, el reflejo del cielo se rompía en motas y parecía nieve. El faldón bajo las toberas de cada SuperDraco es negro mate y de cantos redondeados; era una caja negra brillante que reflejaba el cielo y se leía como un bloque gris atornillado. La **sección de separación en caliente** de Super Heavy tiene aberturas reales en el casco —24 huecos entre columnas, con el canto de la pared visible, tres lamas inclinadas hacia abajo en cada uno y un forro oscuro detrás— en lugar de 24 placas negras pegadas por fuera de un cilindro cerrado. El **escudo térmico** ya no deja ver agujeros entre losetas a ciertas distancias: la capa oscura de respaldo iba solo 2 mm por encima del casco facetado, y entre facetas el acero asomaba por las juntas; ahora va 8 mm por encima (media loseta) con una malla más fina, y la cobertura del morro crece de forma continua hasta la punta en lugar de saltar de 112° a 180°, lo que dibujaba un anillo 3 m por debajo del vértice. Las **llantas del Roadster** muestran las dos caras del barril y la pestaña del borde: antes, a través de los radios, se veía el exterior de la pared opuesta como un arco fino y roto. **Starman** lleva un traje que se lee como tela y no como plástico —exterior mate con brillo de tejido en los bordes y un mapa de pliegues—, más holgado (pecho, brazos y piernas de traje, no de maniquí), con los paneles grafito de hombros y rodillas, cuello grafito en vez de la banda que le cubría el pecho como un chaleco negro, guantes oscuros con manguito, el conector umbilical en el muslo derecho y las bisagras del visor a ambos lados de un casco un 8 % mayor (proporciones reconstruidas de las fotos del vuelo).

El entorno es contexto verosímil, no un levantamiento: la llanura costera de Boca Chica con matorral bajo, dunas y una playa que da al Golfo de México con el agua a unos 450 m de la mesa de lanzamiento (las crónicas sitúan el complejo «a unos cientos de yardas» de la playa de Boca Chica; antes estaba a 1,1 km), un cielo con cúmulos de buen tiempo a 1,4 km (que se desvanecen con la altitud), la explanada del museo en losas de hormigón y el terraplén de la plataforma en talud 1:3 hacia el terreno. Entre la llanura y la playa hay ahora una **duna costera**, como en las fotos de Starbase tomadas desde la playa: una cresta de 2 a 7 m levantada por el viento, con otra más baja y antigua detrás, cortada por huecos de erosión y sujeta por matas de hierba de playa (unas 5 900 matas de nueve hojas, que no se generan en calidad baja). La cara que mira al mar es arena y la cresta y la ladera trasera tienen hierba. Va en su propia banda que sigue la línea de agua, porque la malla del terreno (celdas de unos 40 m) es demasiado gruesa para llevarla, y se asienta sobre la misma función de altura del terreno, hundida unos centímetros en los bordes. Alturas y anchuras son verosímiles para una duna del golfo, no un levantamiento. La **carretera** paralela a la fila es ahora una carretera rural de Texas: calzada de 7,2 m con bombeo central y borde biselado de 5 cm, asfalto envejecido con árido visible, sellado de grietas y parches, rodadas más oscuras en cada carril, arcenes de grava y balizas flexibles cada 40 m. Las marcas siguen el MUTCD de la FHWA: líneas de borde blancas de 15 cm, eje amarillo discontinuo de 3,05 m cada 12,19 m (10/40 ft), y en el vial de acceso una línea de detención blanca de 45 cm a 1,2 m del cruce con su señal STOP R1-1 de 75 cm a la derecha. Su trazado es decorado, no un levantamiento. La llanura tiene además **charcas de marisma** —láminas de agua somera de 40 a 100 m, lisas como un espejo y del color del cielo, bordeadas de barro húmedo que se aclara hacia el limo seco—, como las llanuras mareales que rodean Starbase; están fuera de la fila, los viales y la plataforma, y su posición y contorno son verosímiles, no levantados. El vial de acceso termina al pie del terraplén del pad en una explanada de maniobra; antes seguía hasta desaparecer por debajo del terraplén. La playa se mide desde donde está de verdad el agua: el mar queda 0,9 m por debajo y el terreno solo alcanza esa cota unos 35 m mar adentro de la línea de costa, así que una playa pintada desde la línea de costa dejaba 35 m de ladera con hierba bajando hasta el agua. Ahora el terreno lleva por vértice cuánto tiene de arena seca y de arena húmeda, y el shader quita el matorral y pinta arena clara con una leve ondulación de tono, más oscura en la franja mojada.

![Vista general del centro](docs/screenshots/overview.jpg)

La interfaz de la simulación (menús, ficha técnica, etiquetas y vistas) está en inglés; esta documentación, en español.

## Ejecutar

Es un sitio estático con módulos ES e *import map*; Three.js r170 (núcleo + los addons usados) va incluido en `vendor/three`, así que no depende de ningún CDN. Sólo necesita un servidor HTTP:

```bash
npx serve .            # o: python3 -m http.server 8080
```

y abrir la URL que indique. Requiere WebGL 2.

## Controles

- **Arrastrar** orbita, **rueda** acerca hacia lo que hay bajo el cursor, **botón derecho** desplaza y **doble clic** centra la órbita en el punto señalado (la cámara conserva el rumbo y se acerca a la mitad de la distancia). Los saltos largos entre vistas viajan en arco, para no atravesar la torre ni los vehículos.
- **F** cambia a vuelo libre: `W A S D` mover, `Q`/`E` bajar/subir, arrastrar para mirar, `Shift` ×4, `Ctrl` ×0,2, rueda ajusta la velocidad.
- La vista **In orbit** del Roadster cambia la peana por el adaptador de carga y el suelo por la Tierra, y deja el coche solo: la explanada, sus matorrales, los camiones de servicio y los otros siete expositores se ocultan al entrar y vuelven al salir (antes seguían ahí, y el coche aparecía aparcado sobre hormigón a 30 km de altura).
- El **plano del recinto** (arriba a la derecha) muestra la franja de exposición, los viales y el complejo de lanzamiento, con cada expositor como una parada numerada —un clic la visita— y la cámara como una cuña que apunta hacia donde mira. Se aparta cuando se despliega la ficha técnica y se oculta en pantallas estrechas, durante el vuelo y en la vista orbital del Roadster.
- **1–8** selecciona expositor (del Falcon 1 al Engine Row, en orden cronológico), **0** vista general, **L** etiquetas, **R** regla de altura, **T** pliega la ficha, **H** ayuda.
- **P** (o el botón *Tour*) recorre el centro parada por parada; cualquier arrastre, rueda o clic lo termina y devuelve la cámara.
- **G** (o el botón *Lanzamiento*) arranca la secuencia de Starship. Durante la cuenta atrás y el ascenso la cámara sigue un plan de planos, pero **arrastrar o girar la rueda devuelve el control al instante** sin detener la secuencia. El panel de misión lleva reloj, fase, altitud, velocidad, distancia y empuje, un selector de velocidad ×1 / ×2 / ×5 / ×10 que multiplica el reloj (no salta hitos) y un botón para terminar.
- Deslizador **Sol** de 4° a 75° de elevación: de la luz rasante y cálida de última hora a mediodía (se recalibran luz, sombras, niebla y mapa de entorno). No hay modo noche: el centro es una exposición de día. La inspección visual de referencia es **18°**: a esa elevación el sol es rasante, la exposición ACES se queda en 0,7 y el relleno hemisférico es bajo para que el acero satinado, la pintura blanca, el aluminio y el hormigón no se confundan ni se quemen. El azimut está fijado para iluminar los vehículos desde el lado desde el que miran las vistas por defecto.
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

Del mismo modo, el trunk de la Dragon muestra en su vista principal la mitad de células solares junto a la de radiadores.

### Auditoría externa

En septiembre de 2026 una auditoría de solo lectura hecha con otro modelo (Grok) revisó el código y la simulación. Cada hallazgo se contrastó con el código y, cuando era posible, con su fuente antes de aplicarlo.

**Aplicado:**
- **Pines del propulsor sobre los brazos.** El trío de grid fins en T iba girado con el yaw de exposición de la pila (129,6°), así que los pines de captura quedaban a 39,6° de los brazos. Ahora el trío se orienta contra ese yaw: pines sobre los brazos (±Z) y timón al lado contrario a la torre, que es una elección propia porque no está publicado. El yaw que enseña la línea de losetas se mantiene.
- **Captura en el eje de la mesa.** El empujón lateral de la separación (4,2 m) no se anulaba nunca y el propulsor llegaba a la torre fuera del eje. Ahora se corrige durante la costa. La comprobación automática mide ya en planta que los dos pines caen sobre los brazos (a menos de 3°) y en el eje (a menos de 0,5 m). Antes solo medía la altura y toleraba 60 m.
- **Pines de la nave en el cono de morro.** En la nave V3 se eliminaron los encastres bajo las aletas delanteras y los puntos de izado y captura pasaron al cono, más arriba (NSF, mayo de 2026). La estación no está publicada y va reconstruida justo encima de las aletas.
- **Sin cajas de izado en el faldón del propulsor.** El Block 3 se iza y se captura por los pines de las grid fins.
- **Pluma según los motores encendidos.** La columna del propulsor se estrecha, no solo se atenúa: 33 motores, los 3 centrales en la separación en caliente, el anillo interior en el boostback y 13 que bajan a 3 al final del aterrizaje (vuelo 5).
- **Golfo más cerca.** El agua pasa de 1,1 km a unos 450 m de la mesa: las crónicas sitúan el complejo «a unos cientos de yardas» de la playa.
- **Falcon 9.** Los 1,9 m que faltan para llegar a los 70 m declarados (41,2 + 13,8 + 13,1 = 68,1 m) ya no son un cono que parecía un adaptador medido, sino el faldón delantero de la segunda etapa a diámetro completo.
- **Paso por la torre.** Sale de la altitud integrada (la base supera los 144,5 m de la torre) y no de un T+12 fijo, cuando la curva ya tiene la pila a unos 300 m.
- **Empuje de separación de la nave.** Se limita a los primeros segundos; integrado todo el vuelo sumaba 286 km.
- **Fichas y textos.**
  - El recuento real de losetas (13 132) sustituye a las cuatro cifras distintas que había.
  - El reparto 59/41 del tanque se atribuye al desglose antiguo de 3 400 t.
  - El empuje de la nave indica que los motores modelados suman 1 575 tf.
  - La Dragon ya no llama «publicado» a su ángulo de pared.
  - La ficha del Falcon 9 describe el vehículo limpio.

**No aplicado, con motivo:**
- **Tobera del Raptor a 1,30 m con el anillo exterior a 3,80 m.** No cabe: veinte salidas de 1,30 m necesitan un anillo de al menos 4,14 m de radio, y entonces el labio llega a 4,79 m, fuera del faldón de 4,50 m. Con 3,80 m, las campanas vecinas se solaparían 10 cm. Se mantiene el compromiso de 1,24 m y se documenta como discrepancia.
- **No construir las losetas en calidad baja.** El nivel de detalle ya cambia las losetas por la carcasa lejana según el tamaño en pantalla, con un umbral más estricto en calidad baja. Ninguno de los dos lo ha medido en un teléfono. Quitarlas eliminaría el detalle de cerca.

**Pendiente de foto** (no se inventa la cifra):
- cuánto asoman las toberas del Block 3 bajo el faldón;
- la cabeza del RVac dentro del tanque de oxígeno (tampoco se ve desde fuera);
- la protección metálica de la placa de empuje;
- las cuatro pinzas del Falcon 1 en Omelek, que el propio auditor marcó como conocimiento sin fuente.

### Discrepancias entre fuentes

El modelo no las oculta:

- Las cifras del Falcon 9 (41,2 + 13,8 + 13,1 = 68,1 m) no suman los 70 m declarados; la diferencia se asigna al adaptador de carga bajo la cofia.
- Los ~18 000 losetas y el tamaño publicado de loseta no son consistentes entre sí; el modelo respeta el tamaño.
- Los ≈30 m de envergadura y los ≈116 m² de superficie del Starlink V2 Mini no son compatibles con un ala de 4,1 m de ancho; el modelo respeta la envergadura y queda un 8 % por debajo en superficie.
- Los 12,2 m del Falcon Heavy se miden entre cilindros; las patas plegadas sobresalen unos 0,3 m.

### El complejo de lanzamiento y la secuencia

SpaceX **no publica ninguna dimensión** de su infraestructura de tierra, así que el pad se construye con lo que sí es citable y se reconstruye el resto explícitamente:

| | |
|---|---|
| Citado | torre de 144,5 m (474 ft) · brazos de 36 m · 20 pinzas de sujeción · mesa cuadrada con cubierta refrigerada por agua · zanja de llamas bidireccional de hormigón revestida de inoxidable, con el propulsor varios metros más bajo que en el Pad A · pararrayos y pequeña estación meteorológica en lo alto de la torre · carro de los brazos colgado de una polea en la corona y movido por un cabrestante en la base · desviador de llama hecho de tuberías de acero · agua del deluge en tanques horizontales impulsada por gas a presión · tanque horizontal de LOX de 95 000 galones, tanque de metano de 80 000 galones y subenfriadores de nitrógeno líquido (Wikipedia, *SpaceX Starbase*) |
| Reconstruido (**≈**) | toda dimensión en planta, las cotas de la explanada y de la cubierta, los perfiles de la celosía, el hueco del ascensor y la escalera, la distancia de la torre al eje, el número y tamaño de los tanques del deluge, la fila de tanques verticales, los subenfriadores y todas las posiciones. Los dos tanques horizontales de propelente toman su longitud del volumen citado con un diámetro supuesto de 3,8 m |

Lo que **no** está: no hay mástiles pararrayos exentos ni torres de focos. Durante un tiempo el complejo tuvo dos mástiles de 150 m y cuatro postes de 28 m con foco que ninguna fuente sitúa en el Pad 2; en la vista general se leían como antenas y farolas plantadas alrededor de la plataforma, y se retiraron. La torre, que antes llevaba un núcleo macizo de 5,2 m que la convertía en una losa oscura desde lejos, es ahora una celosía abierta: cuatro pilares, un anillo cada medio tramo, dos recuadros en X por cara y tramo, y dentro el hueco del ascensor y la escalera, por lo que se ve el cielo a través. Los brazos de captura son vigas de celosía en la misma envolvente que medía la verificación. Las almohadillas de apoyo de uno de los dos brazos se construían como cajas de profundidad negativa —vueltas del revés— y la oclusión ambiental las leía como totalmente enterradas: negras y con rayas. El constructor de bloques del pad acepta ahora los extremos en cualquier orden. Las cuatro líneas del puente de tuberías que viene de la granja ya no terminan contra el muro del pad a seis metros de altura: suben en vertical junto al borde, cruzan la cubierta a 4,4 m sobre postes en T —por encima de las tuberías del deluge y de las puertas del búnker— y giran escalonadas, sin cruzarse, hasta el búnker de conexiones del propulsor, dos a la sala del metano y dos a la del oxígeno (trazado reconstruido). El desviador de llama del centro de la zanja es, como describe Wikipedia para el Pad 2, un lecho de tuberías de acero: un núcleo de hormigón en cuña cubierto por tubos de 48 cm tendidos de muro a muro, uno junto a otro por las dos pendientes, alimentados por un colector a lo largo de cada muro y rematados en la cresta (número, diámetro y colectores reconstruidos; la cresta de 4,2 m y la pendiente de 15 m no cambian). Antes era una cuña de acero lisa con unos nervios. El carro de los brazos ya no flota: según Wikipedia (*SpaceX Starbase*) cuelga de una polea en lo alto de la torre y lo mueve un cabrestante con tambor en la base, y así está construido —un bastidor con dos poleas en la corona sobre la cara del pad, dos ramales de cable hasta el carro que se acortan y alargan con él durante la captura, los retornos por dentro de la celosía y una bancada con dos tambores y sus motores junto al pie de la torre (tamaños reconstruidos). El brazo de desconexión rápida de la nave también es ahora una viga de celosía, con pasarela, barandilla y la campana que se cierra sobre el panel de conexiones de la nave.

La escala de lo reconstruido sale de la única referencia dura que hay en cualquier fotografía del pad: los **9 m de diámetro del propulsor**.

**Contraste con fotografías.** El despegue se ha comparado con la foto del vuelo 5 de Commons (*Liftoff of SpaceX IFT-5*) renderizando el nuestro con un teleobjetivo desde un punto parecido, a unos 2,6 km. Faltaban tres cosas, y ahora están:
- **Nube de tierra:** en la foto, segundos después del despegue, ocupa cientos de metros y supera la mitad inferior de la torre; la nuestra eran unas bocanadas grises. Sale ahora más rápido de las bocas de la zanja (125 m/s frente a 92), más grande (crece 150 m frente a 85), vive más y sube con más empuje térmico. El búfer pasa de 860 a 1600 partículas en calidad alta (de 520 a 640 en media y de 240 a 300 en baja, porque lo que cuesta una nube transparente a pantalla completa es el relleno, no el número), y el vapor del agua de la cubierta alrededor de la mesa también crece.
- **Iluminación del penacho sobre la nube:** en la foto, la parte baja de la nube brilla en amarillo-naranja en un par de cientos de metros. La luz del penacho llega ahora hasta unos 160 m y 70 m de altura, en HDR, y cae con el cuadrado de la distancia: la nube va del naranja encendido abajo a su propio blanco grisáceo al sol arriba. Antes se quedaba en un beis a unos metros de las bocas; una primera versión más fuerte la convertía en un muro amarillo plano.
- **Penacho:** una columna Raptor a nivel del mar se fotografía blanca y saturada contra un cielo claro. El núcleo es ahora emisivo (×2,6) y satura a blanco; antes, al sumarse sobre un cielo pálido, quedaba de un crema rosado.
- **Escarcha:** un vehículo cargado de propelente criogénico está escarchado, y el expositor en reposo no (una pieza de museo está seca). Durante la secuencia, unas carcasas sobre los tanques del propulsor y sobre la cara de acero de la nave muestran hielo mate con regueros oscuros de condensación y calvas donde se ha desprendido, con una banda libre en el domo común. Está completa en la plataforma y se va desprendiendo durante el ascenso. La textura mide 4 m de ancho por 16 m de alto para que no se repita a una altura que el ojo pueda captar.

El **Falcon Heavy** se midió contra la foto de la misión de demostración en el LC-39A (*Falcon Heavy Demo Mission*), escalada con los 70 m de la pila y contrastada con la cofia (13,3 m leídos frente a 13,1 m publicados): los tres juegos de grid fins están a la misma altura, unos 40 m, y la punta de los propulsores laterales a unos 45 m. El modelo tenía el cono de los laterales asentado directamente sobre el tanque, con la punta a 41 m y los grid fins a 33 m. Ahora el cono de cada lateral tiene un faldón cilíndrico a la altura de la interetapa del núcleo central, con los grid fins en su parte alta, y la punta queda a 45,2 m.

La Dragon se midió contra la foto de la NASA del Crew-3 en el LC-39A (*SpaceX Crew-3 Falcon 9 Vertical at LC 39A*): el radio de la cápsula a 0,7 / 1,4 / 2,1 / 2,8 / 3,3 m sobre el hombro es de 1,89 / 1,82 / 1,54 / 1,35 / 1,12 m en la foto, frente a 1,90 / 1,76 / 1,59 / 1,36 / 1,15 en el modelo. Coincide en un 3 %, así que el perfil no se tocó.

En el regreso, la cámara acompaña al propulsor en su caída —a unos 400 m y 140 m por debajo— y se asienta junto a la torre cuando se acerca al suelo; antes esperaba en un punto fijo cerca del pad y, en el encendido de aterrizaje, lo dejaba a 5 km: un punto de un píxel en el cielo.

La secuencia sigue la misma disciplina. Los **hitos son los publicados** para el vuelo — despegue T+00:00:02, Max-Q T+01:02, MECO T+02:32, separación en caliente T+02:40 — y hay exactamente **tres entradas de autor** entre ellos: la velocidad en la separación, una curva de velocidad y un giro gravitatorio (72° desde la vertical, τ = 64 s). Los ≈ 5 700 km/h de la separación **no son una cifra publicada**: son el ancla a la que se construye la curva, así marcados en la ficha (`derived`, aproximado) y así documentados en `launch.js`. Ninguna retransmisión ni cronología pública da esa velocidad para este vuelo. **La altitud, la distancia recorrida y la actitud del vehículo se integran de esas dos**, no se declaran aparte; por eso el número del panel, la altura a la que está el vehículo y el ángulo que sostiene no pueden contradecirse. La integración llega a 55,8 km y 81 km de distancia en la separación.

El **regreso del propulsor** sigue la misma regla, con una diferencia honesta: sus cuatro hitos están citados del vuelo 5 —el primero en el que alguien atrapó un propulsor orbital— (boostback T+02:45 a T+03:41, encendido de aterrizaje T+06:30, captura T+06:54), pero **la trayectoria entre ellos es de autor, no integrada**: ninguna fuente pública da la altitud de Super Heavy segundo a segundo. Está anclada a esos cuatro tiempos y a un apogeo de ≈96 km, y así está marcada en la ficha. La velocidad del panel sí se **deriva de la propia trayectoria**, para que el número y lo que se ve no puedan contradecirse.

El penacho se calcula a partir de la presión ambiente, no de un guion: corto, estrecho y con tren de diamantes de choque en la plataforma; ancho y acampanado cuando ya no hay aire contra el que empujar.

### Verificación automática

`src/data/verify.js` hace dos pasadas independientes, disponibles con `?verify` en la URL o llamando a `window.__vc.verify()`:

**1. Dimensional** — mide la caja envolvente real de cada modelo construido, en su propio sistema de referencia, y la compara con lo declarado:

```
vehicle       measure                 declared   built   err%
starship      altura                  124        124        0
starship      envergadura / diámetro  9          9          0
falcon9       altura                  70         70         0
falcon9       envergadura / diámetro  5.2        5.2        0
falconheavy   altura                  70         70         0
falconheavy   envergadura / diámetro  12.2       12.2       0
dragon        altura                  8.1        8.1        0
dragon        envergadura / diámetro  4          4          0
starlink      envergadura             30         30         0
```

**2. Complejo de lanzamiento** — `verifyPad()` mide la geometría construida del pad contra las cifras declaradas (altura de torre, longitud de brazo, cotas de cubierta y explanada, profundidad de la zanja, número de pinzas) y marca cada fila como *prensa* o *reconstruido*. Detectó la losa de la cubierta extruida hacia arriba desde su cota, que había enterrado los 2,4 m inferiores del vehículo dentro de ella.

**2b. Interfaces** — `verifyInterfaces()` mide **dónde dos subsistemas construidos por separado tienen que encajar**, que es donde han vivido los errores caros de este proyecto: cada cifra era defendible por su cuenta y estaba mal contra su vecina. Las campanas de los motores tienen que pasar por el agujero de la mesa (la garganta se cortaba 43 cm dentro de veinte de ellas), las pinzas tienen que llegar al faldón (cerraban a 6 cm de él, y su pie entraba 8 cm por dentro), el propulsor tiene que apoyarse en la cubierta, y los brazos de la torre tienen que cerrarse **a la altura de los pines** (lo hacían 6,8 m por debajo, alrededor del tanque de metano). Todo se mide sobre la geometría construida, nunca recalculando la constante que la produjo.

**3. Integridad de la escena** — recorre todas las mallas y detecta los modos de fallo que realmente han ocurrido en este proyecto: material que muestrea una textura sobre una geometría **sin atributo `uv`** (Three.js deriva las tangentes de las derivadas de `vUv`, así que un `vUv` constante las degenera y la superficie sale negra o reventada), UVs que existen pero son **constantes** (`mergeAll` fabrica un atributo a ceros para que `mergeGeometries` no reviente, que es el mismo fallo disfrazado), UVs **a la escala equivocada**, geometría sin normales, vértices no finitos y **transformadas no finitas**.

La escala de UVs merece su propia nota. El proyecto tiene dos convenciones: UVs en metros contra mapas que fijan `repeat = 1/tileSize`, y UVs normalizadas contra mapas que envuelven una sola vez. Mezclarlas es invisible en el código y ruinoso en pantalla. `toTexture` guarda el tamaño de teselado para el que se creó cada mapa, así que la comprobación no pregunta *¿varían estas UVs?* sino *¿varían al ritmo que esta textura espera?*. Fue lo que dejó cinco kilómetros de explanada con una sola repetición de una textura de 48 m — un téxel cada veinte metros, y el suelo gris liso en todas las vistas generales.

Todas están auto-testeadas: romper cada cosa a propósito hace saltar su comprobación con un diagnóstico útil, y repararla la devuelve a cero.

### Puerta de validación en CI

`npm run check` ejecuta primero las regresiones deterministas de nube, trayectoria y hardware, después levanta el sitio en Chromium headless, recorre las 46 vistas autoradas y termina con cinco tamaños responsive a DPR 2. Comprueba que la cámara es finita, la geometría conserva sus interfaces, el HUD no se solapa, el diálogo modal bloquea los atajos del fondo y la consola queda limpia. La escena principal se carga con `?quality=high` y **se comprueba**: el rasterizador por software sobre el que corre CI caería en el nivel más barato, y la puerta estaría midiendo una escena reducida sin enterarse, porque una escena reducida es coherente consigo misma. Los checks sin navegador requieren Node 22.15 o posterior para cargar Three.js vendorizado sin alterar los imports de producción.

También comprueba las **combinaciones**, que es donde han estado los errores: del lanzamiento al vuelo libre, de la vista orbital al lanzamiento y de vuelta, sol bajo + vuelo completo + reset devolviendo la misma atmósfera, redimensionar en mitad de una transición, veinte cambios de vista seguidos dejando un estado coherente, y el detalle retirándose con la distancia y volviendo al acercarse. Y las invariantes de la máquina de estados directamente: que una vista inexistente cae en la primera del expositor, que la vista orbital se *deduce* en vez de fijarse, y que el dueño de la cámara pasa limpiamente de visita a lanzamiento a visitante.

Cierra con un **presupuesto de escena** que informa en vez de bloquear: triángulos construidos y dibujados, mallas, materiales y texturas. Sus techos están muy por encima de las cifras de hoy, así que detecta que algo se ha duplicado — algo construido dentro de un bucle — sin tumbar una compilación por ruido entre máquinas.

También **recorre la secuencia de lanzamiento**. `launch.seek(t)` reproduce el estado completo de un instante de misión — nube de tierra incluida, resimulada desde la ignición a paso fijo — en vez de limitarse a avanzar, y eso es lo que la hace comprobable: el gate visita diecisiete hitos exigiendo transformadas finitas y cámara sobre la explanada, comprueba que el perfil de ascenso nunca retrocede (hasta la separación: después el panel sigue al propulsor, que baja a propósito), comprueba que **el propulsor sube, vuelve al eje de la torre y los brazos se cierran sobre él**, y comprueba que guardar la secuencia deja la escena **exactamente** como estaba (vehículo, brazo de desconexión, las veinte pinzas, los brazos de captura, planos de cámara y niebla). Sale con código distinto de cero si algo falla, y el flujo de GitHub Actions **bloquea el despliegue** con ella.

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
| ![Ignición](docs/screenshots/launch-ignition.jpg) | ![Ascenso](docs/screenshots/launch-ascent.jpg) |
| ![Separación en caliente](docs/screenshots/launch-staging.jpg) | ![Boostback del propulsor](docs/screenshots/launch-boostback.jpg) |
| ![La torre atrapa el propulsor](docs/screenshots/launch-catch.jpg) | ![Propulsor en los brazos](docs/screenshots/launch-caught.jpg) |
| ![Falcon 9](docs/screenshots/falcon9.jpg) | ![Tesla Roadster](docs/screenshots/roadster-overview.jpg) |
| ![Trasera del Roadster](docs/screenshots/roadster-rear.jpg) | ![Starman](docs/screenshots/roadster-starman.jpg) |
| ![Cámara del selfie](docs/screenshots/roadster-selfie.jpg) | ![Pantalla «Don't Panic»](docs/screenshots/roadster-dontpanic.jpg) |
| ![Faros y morro](docs/screenshots/roadster-detail.jpg) | ![Tierra al fondo](docs/screenshots/roadster-earth.jpg) |
| ![Rueda y paso](docs/screenshots/roadster-underbody.jpg) | ![Fila de motores](docs/screenshots/engines-row.jpg) |
| ![Raptor Vacuum](docs/screenshots/engines-rvac.jpg) | ![Starship completo](docs/screenshots/starship-full.jpg) |

Regenerables con `npm run shots`, que recorre los encuadres declarados en `tools/docs-shots.json`, `tools/launch-shots.json` y `tools/roadster-shots.json`, siempre con el sol a 18° y en calidad alta forzada.

## Estructura

```
index.html                 entrada (import map de Three.js)
vendor/three/              Three.js r170 (build + addons usados)
src/main.js                escena, distribución de los vehículos, oclusión de etiquetas, bucle
src/core/viewState.js      qué está mostrando el centro: dueño de la cámara, expositor, vista,
                           vuelo y mobiliario, como una máquina de estados con transiciones
src/core/lod.js            detalle en función del tamaño en pantalla, para todo el centro
src/core/quality.js        nivel de calidad del dispositivo (píxeles, sombras, post, partículas)
src/core/environment.js    cielo físico, sol, sombras dinámicas, mapa de entorno PMREM
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
src/data/specs.js          ficha técnica con procedencia de cada dato
src/data/verify.js         comprobación de coherencia entre lo declarado y lo construido
src/ui/hud.js              interfaz
```

## Presupuesto de rendimiento

Medido con `npm run profile`, que informa del reparto del arranque, triángulos, draw calls, materiales, texturas y tiempo de fotograma en la vista general, en un primer plano y durante el lanzamiento. La puerta de CI imprime las cifras de escena en cada ejecución.

| | |
|---|---|
| Triángulos construidos | 1 446 827 |
| Triángulos dibujados en la vista general | 877 935 |
| Mallas | 950, de las cuales 533 se dibujan en la vista general |
| Materiales / texturas | 111 / 87 |
| Losetas instanciadas | 13 216 en 1 draw call |

Medido en `25ecf59`, con calidad alta forzada, en la vista general recién cargada y contando igual que la puerta de CI (un grupo oculto oculta a sus hijos). Frente a `1e72486` (1 394 547 / 825 655 / 943 mallas), la subida es sobre todo la torre en celosía abierta, los brazos de captura en viga de celosía, la granja de tanques con anillos, barandillas y escaleras, y el depósito del deluge; a cambio desaparecen los dos mástiles de 150 m, las cuatro torres de focos y el núcleo macizo de la torre. La puerta, que mide después de recorrer el resto de estados, imprime en esa misma revisión 1 465 691 triángulos construidos, 952 mallas, 113 materiales y 88 texturas, y coincide en lo dibujado: 877 935 triángulos y 533 mallas.

Las losetas usan un prisma hexagonal de 28 triángulos sin cara trasera (nunca visible, siempre apoyada en el casco) y un chaflán superior que da el brillo del borde.

### Nivel de detalle

`src/core/lod.js` hace una sola pregunta por entrada — *¿cuántos píxeles ocupa ahora mismo el detalle más pequeño que esto dibuja?* — y con la respuesta cambia entre estados que los constructores ya produjeron, o deja de dibujar lo que nadie puede ver. **No simplifica mallas ni construye modelos alternativos**, así que las vistas cercanas quedan exactamente igual.

Cada entrada declara `lodFeature`: el tamaño real, en metros, de la pieza más pequeña que contiene. Así el mismo umbral significa lo mismo en una loseta de 0,26 m, en el marco de una ventana de la Dragon y en la junta de 2 cm de su panel trasero.

- **Escudo térmico.** Trece mil hexágonos de 0,26 m se vuelven ruido sub-píxel a unas decenas de metros. Pasados ~90 m las instancias se sustituyen por una superficie de revolución con el mismo mosaico horneado, cubriendo la misma ventana angular: de cerca se ve la geometría real; de lejos, un panel limpio — y 373 000 triángulos menos.
- **Interior del Roadster y Starman.** 86 mallas sobre un coche de 3,9 m que en la vista general mide ocho píxeles. Los asientos cosidos, el Hot Wheels del salpicadero y la placa de circuito dejan de dibujarse; la carrocería, las ruedas y el cristal no, porque son la silueta.
- **Filigrana de la Dragon.** Juntas de panel, marcos, bisagras y tornillería, separadas en dos lotes porque un marco de ventana de 26 cm se lee mucho más lejos que un tornillo de 1,4 cm.

Medido en la vista general contra la misma escena con todo forzado a su estado detallado: **533 mallas y 877 935 triángulos, frente a 828 y 1 394 203**. Son 182 grupos, y todos se retiran en la vista general.

### Estabilidad de la imagen

La cámara usaba un plano cercano fijo de 0,15 m con el lejano a 9 km. La resolución del búfer de profundidad cae con el cuadrado de la distancia, así que en la vista general, a 400 m, solo distinguía superficies separadas más de ~0,6 m: losas, marcas viales, blindaje de la zanja y la línea de agua parpadeaban contra lo que tienen debajo al mover la cámara. Ahora el plano cercano sigue a la distancia de órbita (el 0,6 % de ella, entre 0,1 y 2 m), unas trece veces más precisión en la vista general sin perder nada de cerca. La secuencia de lanzamiento fija sus propios planos y, al terminar, devuelve los que tenía la cámara cuando empezó.

Las sombras tenían un problema parecido: el volumen de sombra del sol seguía al objetivo de forma continua y cambiaba de tamaño con cada paso de la rueda, así que cada téxel del mapa de sombras caía cada fotograma en un sitio ligeramente distinto y todos los bordes de sombra de la escena titilaban al mover la cámara. Ahora el tamaño cambia en escalones de ×1,2 —unas pocas veces en todo el recorrido del zoom— y el centro se ajusta a la rejilla de téxeles en el propio marco de la luz, de modo que un téxel cubre siempre el mismo trozo de suelo. El volumen mínimo baja de 36 a 12 m de lado, así que en los primeros planos cada téxel mide 3 mm en lugar de 9.

Un tercer fallo tenía la misma familia de causa: una pieza metálica fina y curva —un anillo de soldadura, una barandilla, un tubo— siempre tiene algún píxel que refleja el sol directamente hacia la cámara, y en HDR ese píxel puede valer cientos de veces el blanco. El bloom lo esparcía por su cadena de mipmaps como un cuadrado blanco flotando junto al vehículo (se veía al lado de Super Heavy durante el boostback y el aterrizaje). Antes del bloom, un pase limita ahora el pico de cada píxel a 12, muy por encima de donde ACES ya satura a blanco: la imagen final no cambia y el bloom deja de convertir píxeles sueltos en bloques.

### Niveles de calidad

`src/core/quality.js` elige uno de tres niveles al arrancar, a partir de lo que la máquina declara —no de su *user-agent*— y fija con él la densidad de píxeles, la resolución del mapa de sombras, la oclusión ambiental, el bloom, el MSAA, el umbral de detalle y el número de partículas de la nube. **El nivel cambia el coste, nunca la corrección**: los vehículos se siguen construyendo a 1:1 desde las mismas cifras y la verificación mide lo mismo. `?quality=low|medium|high` fuerza uno, que es como se prueba un nivel que no tienes — y cómo la puerta de CI se asegura de estar midiendo la escena completa, ya que el rasterizador por software sobre el que corre caería si no en el nivel más bajo.

## Despliegue

El flujo de GitHub Actions en `.github/workflows/pages.yml` publica el sitio en GitHub Pages.
