# Físicas del mapa, choques y Flight 14

Los choques y la nave cayendo al agua (3 de octubre), las físicas del mapa y la misión única de Flight 14 (2 de octubre de 2026).

Las secciones de este archivo se movieron del `README.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo bajó un nivel el título de cada sección). Los números de línea, rutas y nombres de sección que citan siguen siendo los de entonces.

[← Índice de rondas](README.md) · [← README](../../README.md)

## Choques de verdad y la nave cayendo al agua (3 de octubre de 2026)

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

## Físicas del mapa: agua de verdad, desniveles y colisiones con todo (3 de octubre de 2026)

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

## Flight 14: una sola misión del corte a la entrada (2 de octubre de 2026)

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
