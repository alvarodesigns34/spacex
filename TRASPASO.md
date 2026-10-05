# Traspaso de contexto: SpaceX Vehicle Center 3D

Hola, Claude. Continúas un proyecto que llevo trabajando contigo durante muchas sesiones. Aquí tienes todo lo necesario para seguir exactamente donde lo dejamos, con los mismos criterios y la misma forma de trabajar. Léelo entero antes de hacer nada.

---

## ⭐ Empieza aquí (estado real al 05-10-2026: lee primero «Sesión del 05-10-2026 (quinta)», después «Sesión del 04-10-2026 (cuarta)» y «Cierre de la sesión del 04-10-2026 (tercera)»)

### Sesión del 05-10-2026 (quinta, rama `claude/youthful-noether-0ihafx`): la H2R «nivel Blender, literalmente»

- **Orden del usuario:** «En esta iteración quiero que te centres al máximo en la H2R. Ahora sí, nivel blender pero literalmente. Organiza el código en diferentes archivos por piezas si es más cómodo. DETALLE ABSOLUTO.» El encargo amplio (F-16, Porsche, entorno, físicas) sigue de fondo.
- **Método, sistema a sistema** (un commit por sistema, todos empujados a las seis ramas con CI en verde salvo el último, en marcha al escribir esto):
  - `2fbf921`: refactor: `src/vehicles/h2r.js` reexporta desde `src/vehicles/h2r/` (un archivo por pieza). Verificado idéntico (huella y recuentos).
  - `f117abe`: ruedas (neumático con banda y flanco, llanta, radios), discos flotantes con taladros reales, pinzas Stylema por lado (`mirrorZ`), pinza trasera, latiguillos, cadena 525 eslabón a eslabón (`chain.js`).
  - `ffd6e45`: horquilla (`fork.js`), tijas (`clamps.js`), mandos (`controls.js`); `steer.js` es el montaje.
  - `51d395c`: escape (bridas, colector dorado alineado, silenciador cónico cortado en bisel con labio y núcleo, unión con muelles). Tenía las caras del revés (se veía negro).
  - `7ac2516`: motor como carpeta `engine/` (`parts.js`, `core.js`, `right.js`, `supercharger.js`, `chamber.js`); tapa del embrague trazada en mm sobre la foto derecha; emblema «SUPER CHARGED»; compresor con rodete de 6+6 álabes (gira 9,2× el cigüeñal en `h2rRide.js`); cámara de admisión; el conducto de admisión de aire dinámico tenía las caras hacia dentro.
  - `5c7773b`: lado izquierdo del motor, estriberas (`rearsets.js`, trazadas en mm), V y soldaduras del chasis.
- **Fuente primaria nueva:** Kawasaki Technical Review n.º 180 (julio de 2019), «Development of Ninja H2 Series»: figs. 3 (motor), 4 (chasis solo) y 10 (rodete); álabes ≈1 mm, ≥120.000 min⁻¹. El PDF lleva las imágenes en CMYK invertido: `pdfimages -j` y luego invertir los canales.
- **Calibración de la foto derecha** («Kawasaki Ninja H2R right», Commons, 1280 px): semejanza fijada por los centros de los ejes, foto (192,5; 507,5) y (1072,5; 542,5) px contra el render lateral casi ortográfico (ejes en (333; 500) y (1215; 515,1) px a 1,6441 mm/px). Con eso, `model_mm.png` (la foto proyectada al plano lateral del modelo, 1 px = 1 mm) y las rejillas en mm. Ver el Anexo (`ortho.py`, `blend.py`, `seg.py`, `mgrid.py`, `p2m.py`).
- **Lecciones:**
  - Las comprobaciones de normales no ven una malla entera del revés (es coherente consigo misma). Usa el **volumen con signo** (`vol.js` del Anexo): negativo = del revés. Lo encontraron el silenciador y el conducto.
  - `mergeAll([])` da una malla sin vértices (pasó con `h2r-engine-covers`); busca mallas sin `position` (`empty.js`).
  - `ext()` de `engine/parts.js` mete el contorno hacia dentro el ancho del bisel (antes lo agrandaba) y suaviza las normales del canto (`withCreaseNormals`).
  - `_frames.mjs`: el **primer** encuadre de cada tanda sale a menudo vacío (o enfoca el Porsche): `mk.py` ya antepone un encuadre `_warm`. Variable `HIDE` (expresión regular de nombres de malla) para ocultar el carenado.
  - Sin fotos del amortiguador trasero ni de su bieleta no se ha inventado su disposición (regla de medidas verificables); solo queda el depósito dorado.
- **Pendiente (orden propuesto):** sistema 6, carenado (lo que más se ve y lo que más difiere de la foto: depósito más bajo con su toma lateral hundida, costado en capas facetadas, carbono, aletas inferiores, juntas y tornillería); sistema 7, materiales (cromo espejo, carbono); después el `npm run check` completo y cerrar.

### Sesión del 04-10-2026 (cuarta, rama `claude/youthful-noether-0ihafx`): encargo nuevo, solo F-16, Porsche y H2R

- **Decisión del usuario:** NO a la «red de seguridad» de la H2R sin ayudas. Queda como está.
- **Errata corregida:** en el README (*Controles*), la línea del botón *Simple* estaba en la lista de la H2R; es del F-16 (`src/ui/f16Hud.js`).
- **Encargo (ambición máxima; nada de SpaceX ni del Roadster):**
  1. modelos 3D de F-16, Porsche y H2R mucho mejores, como un proyecto de Blender (mallas, texturas, reflejos, piezas), sin simplificar; si el presupuesto limita, se amplía;
  2. realismo de conducción y vuelo: velocidades y aceleraciones reales, bugs;
  3. entorno y realismo, a fondo;
  4. pasada final de bugs y mejora amplia de las físicas.
- El usuario pidió un despertador a 1 h 47 min para seguir (programado para las 00:23 UTC del 05-10).
- **Hecho en esta sesión (todo empujado a las seis ramas, CI en verde):**
  - `29414b5`: errata del botón *Simple* y traspaso.
  - `610307b`: F-16, toma de aire con la ranura del desviador (un surco de la misma superficie que se cierra en `SLOT.s1`), labio redondeado, conducto claro; corte de la cabina por una fila de vértices (índice `KC` del cuarto superior: sin dientes); secciones a 24 + 24 puntos. Pruebas nuevas en `check.mjs` (área de captura en el borde del labio, 0,531 m²; ningún vértice de la piel dentro de la abertura; con el código viejo, 31).
  - `e17084a`: cabina del F-16 (ACES II, consolas, palanca lateral, gas, panel con esferas), material `f16-seat`.
  - `0ebefe4`: lanzador de punta de ala como raíl perfilado.
- **Auditoría visual hecha (renders cercanos de los tres):**
  - F-16: lo más tosco; corregidos cúpula, toma, cabina y lanzador. Pendiente: tren (puertas planas, patas cilíndricas), luces de formación, receptáculo de repostaje, más paneles.
  - Porsche: la disposición coincide con las fotos libres de Commons (`Porsche 911 GT3 RS (2022) 1X7A7164.jpg`, `Porsche 992 GT3 RS DSC 9055.jpg`): aletas negras delante y detrás de la rueda delantera y delante de la trasera, entradas del paragolpes, capó, barra de pilotos. Lo que lo hace parecer de juguete es la pintura casi mate en una llanura abierta; el mapa de entorno ya tiene cielo y suelo. Pendiente: afinar el frontal (paragolpes algo abombado en las esquinas).
  - H2R: el escape ya estaba trazado sobre la foto lateral (silencioso a ≈21°, boca ≈0,15 m por delante del eje trasero: medido de nuevo, coincide). Pendiente: carenados laterales facetados, reflejo cromado.
- **Física (punto 2), pendiente de fuente:** el despegue del F-16 con postcombustión en la prueba (rota a 135 kt, despega a 172 kt a 407 m, 20.500 lb). Una recopilación secundaria (migflug.com) da 725 m a 29.253 lb con depósitos; escalado por W², ≈360 m. Sin fuente primaria no se ha tocado.
- **Red:** Commons limita mucho (429). Las miniaturas de 960 px suelen estar en caché y bajan cuando las de 1280 px dan 429.
- **Herramientas locales nuevas:** `mk.py` en la carpeta temporal (encuadres en el marco del vehículo: `python3 mk.py salida.js <expositor> nombre px py pz tx ty tz ...`, cámara con `v.rig.jumpTo`); el F-16 está centrado en su longitud: la estación s está en x = 7,52 − s.
- **Check completo** local tras `0ebefe4`: código 0.
- **Tras el despertador (00:23 UTC del 05-10):**
  - `e8ce4fd`: tren de morro del F-16 como en las fotos de Twenthe (pata inclinada, rueda adelantada, tirante largo, una sola compuerta a la derecha).
  - `ebc69b3`: la antena de pala del vientre del F-16 estaba reflejada con escala −1 (caras del revés, se veía negra).
  - `41ac91a`: **detector de caras del revés** en `check.mjs` para F-16, Porsche y H2R (triángulos que giran al contrario que sus normales). Encontró y se corrigieron las pinzas de freno izquierdas del Porsche (`ca.scale(1, 1, side)` sin girar las caras) y los tornillos izquierdos de la cúpula de la H2R (ahora con `mirrorZ`). **Lección:** reflejar una geometría con escala negativa da la vuelta a sus caras; usa `mirrorZ` (h2rParts.js) o invierte el índice.
  - `3190333`: prueba de la velocidad máxima del F-16 a nivel del mar (Mach 1,19 en 200 s; publicada ≈Mach 1,2). A 3.000 m Mach 1,43 y a 11.000 m Mach 2,06.
  - **F-16 con mandos completos al azar** (`tools/_fuzz.mjs`, local): 20 recorridos de 120 s, todo finito, nunca bajo el suelo. En tierra, a ≈120 kt, el alabeo a fondo con la palanca adelante tumba el avión sobre un ala (α negativo, el tren principal descargado; en tierra el alerón ya va limitado a 10°). Sin datos primarios del modo en tierra del FLCS, no se ha cambiado. Con los mandos simples no pasa (en tierra centran los alerones).
  - Foto libre de la H2R sin carenado (`Kawasaki_Ninja_H2R_exposed_left_rear.JPG`, 960 px): confirma el basculante y la cadena a la izquierda y el chasis en triángulos; sin corrección clara pendiente.
- **Multiagente:** sigue la orden del usuario de no usar flujos de varios agentes; todo a mano.

### Cierre de la sesión del 04-10-2026 (tercera, rama `claude/pensive-ride-5sjdza`): LAS CUATRO FASES HECHAS

- **Último commit de código:** `8751a7c` (y después solo documentación), en las seis ramas: `claude/pensive-ride-5sjdza`, `claude/spacex-vehicle-center-3d-48zlkm`, `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo` y `claude/affectionate-euler-o447rh`. El `npm run check` completo pasó en local (303 PASS, 0 FAIL), y el CI y el despliegue de Pages salieron en verde en las seis.
- **Commits de la sesión, en orden:**
  - `dc4563e`: arreglo del CI;
  - Fase 1: conducción;
  - `9f544cd`: sonido sin rugosidad;
  - `09d340f`: Fase 2, primera parte (motor, escape y basculante de la H2R; `detail.js`);
  - `a996ce9`: arreglo del CI de la prueba del mando;
  - `e808102`: Fase 2, segunda parte (Porsche y F-16 Hill Gray);
  - `d240bb6`: Fase 3, sonido (`f16Sound.js`, `audioBus.js`);
  - `64f40da`: Fase 4, viento y efecto suelo;
  - `8751a7c`: el F-16 rueda recto con viento cruzado.
- **El detalle de cada fase** está en el README: *Fase 1…*, *Fase 2 del encargo, primera/segunda parte*, *Fase 3 del encargo: sonido*, *Fase 4 del encargo: física y entorno*.
- **Pendiente de decisión del usuario:** si quiere una «red de seguridad» para la H2R sin ayudas. Hoy, sin ayudas, solo se cae en choques fuertes gracias a los reflejos del piloto simulado. La alternativa es un tope invisible de inclinación y de caballito también sin ayudas. No se ha tocado.
- **Aproximaciones y huecos conocidos (dichos al usuario):**
  - el empuje lateral del viento sobre la moto inclinada no está modelado;
  - el cambio de cabeceo del F-16 en efecto suelo, tampoco;
  - el número de álabes y los regímenes del F100 son ≈;
  - en el Porsche quedan algún diente pequeño en el borde trasero de la ventanilla y unas aletas negras algo cuadradas;
  - las líneas de separación del Hill Gray son ≈ (fuentes de modelismo).
- **La galería de capturas NO se ha regenerado**: necesita la aprobación del usuario.
- **Multiagente:** el usuario pidió expresamente NO usar flujos multiagente («hazlo tú mismo, poco a poco»). Esa orden manda aunque `ultracode` esté activo en `.claude/settings.json`.
- **Herramientas locales nuevas** (excluidas en `.git/info/exclude`, se pierden con el contenedor; ver el Anexo):
  - `tools/_uxtail.mjs`: solo el bloque del F-16 de `ux-check`, una copia que hay que sincronizar a mano;
  - `tools/_f16snd.mjs` y `tools/_f16wav.mjs`: miden el worklet del F-16 y renderizan WAV de muestra;
  - `tools/_wl.mjs`, `tools/_xw*.mjs` y `tools/_gp.mjs`: sondas de aterrizaje y despegue con viento y del mando.
  - Al usar `_frames.mjs` o `_probe.mjs`, no lances dos a la vez en el mismo puerto (`--port`).
- **Lecciones de esta sesión**, además de las de cada fase:
  - prueba los automatismos con el viento puesto;
  - las pruebas que miden un mando, hazlas diferenciales;
  - en `ux-check` el bucle de animación no corre: avanza la simulación a mano (`F.update`);
  - `Material.clone()` no copia `onBeforeCompile`;
  - para importar módulos en Node, `registerHooks` necesita también la rama `three/addons/`.

### Sesión del 04-10-2026 (segunda): aplicando la pasada decisiva

- **Rama de la sesión:** `claude/gifted-bohr-7bjkq9`. Se empuja a las cinco ramas y a esa.
- **Configuración de Claude Code:** `.claude/settings.json` del proyecto lleva `effortLevel: high`, `ultracode: true` y `enableWorkflows: true`, por petición del usuario. Con ultracode activo, cada tarea sustancial se hace con un workflow de varios agentes. El tamaño por defecto en Pro es *small* (menos de 5 agentes).
- **Sesión del 04-10 (tercera, rama `claude/pensive-ride-5sjdza`):** CI de `9917115` estaba en rojo (ux-check, «A restored WebGL context…»). Causa: la prueba de la H2R despachaba G sobre `window` y arrancaba el lanzamiento (ver README, *CI en rojo tras el bloque 3*). **Lección:** en las pruebas, las teclas sintéticas se despachan sobre `document.body`, nunca sobre `window`.
- **Encargo reordenado por el usuario (04-10, tercera sesión), en cuatro fases con un commit cada una:** 1) conducción (H2R sin caídas tontas, con tecla para levantarla y solo el límite de inclinación; F-16; Porsche), 2) modelos 3D (H2R y Porsche «mega a fondo», como un proyecto de Blender con texturas en cada pieza; F-16 retocado), 3) sonido (F-16 realista con botón; Porsche y H2R), 4) físicas y entorno. **Entre fases, solo `check:static`; el `npm run check` completo, una vez al final de las cuatro.** Nada de flujos de varios agentes: todo a mano, poco a poco.
- **Fase 2 (modelos), HECHA.** Hecho y empujado: `src/materials/detail.js` (detalle de superficie triplanar en el espacio de la pieza: fundición, cepillado, granulado, goma, piel de naranja, grano, sarga), aplicado a la H2R; el motor de la H2R rehecho en `src/vehicles/h2rEngine.js` (medido sobre la foto libre de Commons «Kawasaki Ninja H2R right», calibrada en los ejes: 1,644 mm/px); escape con el degradado térmico del titanio y silencioso largo con boca en bisel; basculante monobrazo de fundición con la corona por fuera; nudos del chasis con soldadura y tornillo. Las fotos de referencia se bajan de upload.wikimedia.org con la ruta md5 (ver más abajo), a la carpeta temporal. **Lección:** el perfil de un `LatheGeometry` tiene que subir por el eje o sus caras miran hacia dentro (las tapas del motor viejo eran invisibles por eso). Segunda parte (README, *Fase 2 del encargo, segunda parte*): Porsche con detalle en todos sus materiales (también el habitáculo), piel de naranja en la laca (`applyDetail` perturba ahora la normal del clearcoat: opción `coat`), juntas de panel con canto redondeado (`gapOnBody` + `gapPaint`), puerta por spline, retrovisores lisos con la línea pintura/negro resuelta por sección, banda de pintura sobre los dientes de las lunas (por encima del vidrio, que va 2 mm elevado), reborde protector en los neumáticos, pernos del disco flotante y aletas con cantos redondeados; F-16A con el esquema «Hill Gray» de tres tonos (FS 36118/36270/36375, ≈ según referencias de modelismo), desgaste discreto y detalle de superficie. **Lecciones:** `Material.clone()` copia `userData` pero no `onBeforeCompile`: tras clonar un material con detalle, borra `userData.detail` y vuelve a aplicarlo; para fusionar vértices con `mergeVertices` borra antes las normales planas. CI de la Fase 1 arreglado en `a996ce9` (la prueba del mando leía los alerones). Pendiente de la fase 2, si da tiempo: la H2R (carenados) ya tiene su pasada; nada más obligatorio.
- **Fase 4 (física y entorno), HECHA** (README, *Fase 4 del encargo*): `src/core/wind.js` (SSE 6,2 m/s a 10 m según NOAA Brownsville, ley logarítmica, turbulencia congelada, determinista), F-16 con viento y efecto suelo (`groundEffect`), gas por energía total en la aproximación de los mandos simples, Porsche y H2R con resistencia respecto al aire (`wind` opcional en `createGt3Car`/`createH2rBike`/`createF16Flight`; las pruebas vuelan en calma salvo que lo pasen), manga de viento animada (`userData.tick`), vapor a sotavento (`Vapor.update`), olas con dirección; `tools/wind-check.mjs`. **Lecciones:** un viento con ráfagas destapó un fallo real del autoacelerador (velocidad sola en vez de energía total); y el viento cruzado, que los mandos simples no usaban el pedal en tierra (efecto veleta: 26° en 10 s). Los pedales van ahora en lazo cerrado sobre la guiñada, con integral y seguimiento del eje de pista. Prueba siempre los automatismos con el viento puesto, y haz diferenciales (con y sin la entrada) las pruebas que deben medir solo el efecto de un mando.
- **Fase 3 (sonido), HECHA** (README, *Fase 3 del encargo*): `src/sim/audioBus.js` (un solo AudioContext, bus maestro, política de pestaña oculta con `claim(id, on)`, `createSpatial(ref)` con retardo d/c = Doppler, HRTF, 1/d y absorción); `src/sim/f16Sound.js` (F100: fan con buzz-saw por PolyBLEP, núcleo, chorro con Strouhal 0,2, poscombustor con crepitar y golpe de encendido, cabina, ruedas, tren, cono de Mach y estampido; tecla M y botón Sound); Porsche y H2R con rodadura y sonido espacial; el lanzamiento en el bus compartido. **Lección:** en el arnés de pruebas el bucle de animación no corre: para medir sonido en `ux-check`, avanza el vuelo a mano (`F.update`) mientras mides. Para importar módulos con `three/addons` en Node, el hook de `registerHooks` necesita también esa rama.
- **Fase 1, HECHA** (README, *Fase 1 del encargo*): H2R con `CRASH`, reflejos del piloto, `pickUp()` y R; F-16 con dirección limitada por la velocidad, neumático por deriva, autoacelerador `vHold`, nivelado, suelo de 145 kt, `f16Cue.js` y cámara por desplazamiento. Sonido 4a (explosiones fraccionarias, AudioParam, silbido de la H2R) ya está hecho y empujado: es parte de la fase 3.
- **Bloque 1, cuadrado negro: HECHO.** README, *Pasada decisiva, bloque 1*.
  - Filtro a prueba de NaN e Inf, con `isnan` y con los bits del exponente (`main.js`).
  - `buildSplitter` sin puntos alineados.
  - `sanitizeNormals(scene)` al arrancar (`geometry/utils.js`; resultado en `__vc.sanitized`), y otra vez tras cada abolladura en `gt3Damage.js`.
  - El pase de AO escribe «sin normal» si la normal no es finita (`core/ao.js`).
  - `gl_PointSize` acotado en `gt3Drive.js`.
  - Pruebas: dos en `check.mjs` y una en `gt3rs-check.mjs`.
  - Una revisión adversarial con tres agentes encontró los daños, el AO y la falta de control positivo; todo está corregido.
- **Lecciones del bloque 1:**
  - Ningún pase anterior al bloom debe dejar pasar un NaN.
  - No dejes puntos alineados en el contorno de un `ExtrudeGeometry`.
  - `computeVertexNormals` en una geometría no indexada vuelve a dar (0, 0, 0) en los triángulos de área cero: sanea después.
  - Una prueba de regresión necesita un control positivo. La primera versión de la prueba del NaN pasaba también con el código roto: el cuadrado forzado quedaba dentro del plano cercano (a 2 m en esa vista) y no se dibujaba.
  - El multimuestreo de SwiftShader se traga el NaN: para verlo, pon `samples = 0` en los render targets del compositor y haz `dispose()`.
- **Bloque 2, H2R: HECHO.** README, *Pasada decisiva, bloque 2*.
  - `h2rBike.js`:
    - agarre compartido con prioridad lateral (`axBudget`, `s.budget`);
    - límite de inclinación (`s.stop`, que baja a `STAND_UP` = 0,9 rad/s; `s.slideCap` al abrirse de trazada);
    - `hE` = h·cos φ en el cabeceo;
    - agua fuera del agarre;
    - colisión por sub-pasos de 10 cm, con normal contraria al movimiento;
    - vuelo en los cambios de rasante (`s.air`, `s.vy`);
    - `GS` = cos(avance);
    - caja con `input.auto` (G) y reducción rechazada (`s.shiftRefused`);
    - `ENGINE.launchClutch` y `ENGINE.friction` nuevos (ESTIMATE).
  - `h2rRide.js`: G, avisos, cámara del piloto (`head`), cabeceo desde el reposo (`SAG`) y chispas al rozar.
  - `h2rHud.js`: marcas del límite y testigos ABS, TC y LEAN.
  - `specs.js`: ficha actualizada.
  - Pruebas: `h2r-check.mjs` (sección «Ridden as the keyboard rides it» y siguientes) y `ux-check.mjs` (la moto en la pista, z = 490).
- **Decisión pendiente del usuario:** sin ayudas la moto vuelca por delante con el freno a fondo en recta (en los recorridos aleatorios, 199 vuelcos y 54 caballitos, todos permitidos). ¿Red de seguridad?
- **Bloque 3, Porsche, PRIMERA PARTE HECHA** (README, *Pasada decisiva, bloque 3 (primera parte)*).
  - Hecho: P0-1 (DRS), P0-2 (`steerReach`/`steerRate`), P0-3 (`gt3Pad.js`), P1-4/5 (PDK sin hueco, mapa, *kickdown*), P1-6 (equilibrio: `BAL.perAxle`), P1-7 (`s.slipShown`), P1-8 (`DIFF`, PTV Plus implícito), P2-9 (ABS PI), P2-11 (giro de 10,53 m, `maxSteer` de 32°).
  - El control de tracción también lee el deslizamiento combinado.
- **Bloque 3, SEGUNDA PARTE HECHA** (README, *bloque 3 (segunda parte)*): PSM en tres etapas (`s.psm` 'on' | 'escOff' | 'off'; `s.tc` queda como accesor: lee «no del todo apagado» y, al asignarlo, enciende o apaga entero), testigos TC/PTV/LOCK y etapa en el HUD, `src/sim/gt3Camera.js` (cámaras por tiempo y vibración por distancia, `s.odo`), sonido y mando en los pianos, relajación según la carga (`relaxationLength`), constantes del neumático en `TYRES`, dirección trasera del dossier (`rearSteerShare`), `tools/gt3rs-lap.mjs` en `check:static` (referencia `REF` en el archivo: si un cambio de la física la mueve a propósito, actualízala con `--update` y explícalo). Revisión adversarial hecha a mano (el usuario pidió no usar flujos de varios agentes): `revisiones/bloque3-porsche.json`.
- **Bloques 4 y 5, sin empezar** (el usuario, el 04-10: «no utilices flujo de trabajo multiagente, hazlo tú mismo poco a poco»):
  - 4, sonido: `sonido.json` y `f16.json` (explosiones en tiempo fraccionario, silbido de la H2R, modelo espacial con Doppler, sonido y botón del F-16);
  - 5: auditar primero los modelos de H2R, Porsche y F-16, y el entorno y las físicas, con renders cercanos y evidencia; guardar los diagnósticos en `docs/`; y luego implementar.
- **Revisiones de los agentes guardadas:** `docs/diagnostico-2026-10-04/revisiones/` (bloques 1 y 2; todo lo encontrado está corregido, salvo la moto parada que no rueda hacia atrás en una cuesta).
- **Lecciones de esta sesión:**
  - Una prueba nueva tiene que fallar con el código viejo. Dos pruebas mías pasaban en vacío (el NaN dentro del plano cercano y la moto que no llegaba a patinar). Comprueba siempre que la condición se da.
  - Trabajar un bloque en un `git worktree` aparte (en el scratchpad) permite verificar y hacer commit del anterior sin mezclar.
  - **Cuidado:** un worktree con `node_modules` enlazado y `git add -A` mete el enlace en el commit; al fusionar, sustituyó el `node_modules` real. Añade `node_modules` al índice nunca (bórralo con `git rm --cached`) o enlázalo fuera de `git add -A`.
  - Las revisiones adversariales con 3 agentes encontraron 3 y 18 defectos reales; merecen la pena antes de cada commit grande.

### Estado al 03-10-2026 (léelo primero)

- **Ramas:** las cinco apuntan a `d119f84`, con los despliegues de Pages en verde.
  - `claude/spacex-vehicle-center-3d-48zlkm`
  - `claude/dreamy-bell-qn1eth`
  - `grok/sun18-audit-10c9929`
  - `claude/elegant-ptolemy-l99qgo`
  - `claude/affectionate-euler-o447rh`
- **Hecho en la última sesión:**
  - `098f64d`: la Ninja H2R, rehecha. README, *La Ninja H2R, rehecha*.
  - `5ef0196` y `d119f84`: el Porsche, mejora 7. README, *mejora 7*.
    - Llantas de radios en Y; frontal inferior hundido; faros cromados; rejilla del motor y piloto central.
    - Parabrisas envolvente (`WRAP` en `inWindscreen`), que deja un montante A fino.
    - Levas E/Q/G; cabeza del piloto con fuerzas G; sonido del bóxer por AudioWorklet; luces de freno vivas.
- **Sesión del 03-10 (tercera, rama de sesión `claude/sleepy-cannon-a1exgi`):**
  - `1a072a7`: el Porsche lee el suelo bajo sus ruedas en `reset()` (fallo intermitente de CI en «B starts the Porsche…»); CLAUDE.md con cinco ramas.
  - H2R contra fotos de Commons calibradas: alas, parabrisas, cuernos, morro, carenados inferiores, tija y motor. README, *La Ninja H2R contra fotos calibradas*.
  - Las fotos oficiales de kawasaki.eu y del newsroom de Porsche **no se pudieron descargar**: el clasificador de permisos bloqueó la descarga con curl y el registro de la CA del proxy para Chromium. WebFetch sí lee páginas de texto. Si hacen falta, pide al usuario que permita esas acciones.
  - Conducción de la H2R contra MOTORRAD (Lausitzring, GPS): transferencia de carga por la resistencia del aire añadida; h, CdA y pérdidas ajustados (`PRESS` en `data/h2r.js`). Frenada del Porsche contrastada con auto motor und sport (28,0 m y 97,0 m; leídas en el resumen del buscador, la tabla está tras muro de pago).
  - **Error cometido:** `033eaae` rompió CI (`check:scene`): 292 materiales (límite 290 en `check.mjs`) y anchura de la H2R a 0,843 m (verify exige ±0,5 %). `h2r-check` aceptaba ±1 cm y por eso `check:static` no lo vio. Corregido reutilizando materiales (288) y con las puntas de las alas a ±0,4245 m; `h2r-check` usa ya la tolerancia de verify. **Lección:** un material nuevo cuenta para el presupuesto de 290; reutiliza los existentes.
  - Porsche revisado con 18 fotos libres de Commons: la parte baja negra trasera es correcta (no tocar); no hay fotos libres del interior.
  - Banco (carpeta temporal, se pierde): `bench/server.mjs`, `page.html` (render con `K`/`Rt` de OpenCV), `shoot.mjs`, `frames.mjs` (la app real); `cal/solve2.py` (PnP con punto principal y un grupo de puntos con desplazamiento libre, para la rueda en el caballete), `cal/tri.py` (`fuse`: x, y de la lateral; z de la frontal), `cal/overlay.py`.
- **Encargo del usuario del 04-10 (pasada decisiva; detenido por el usuario a las 08:30 UTC tras el diagnóstico):**
  1) Modelos 3D hiperrealistas de H2R, Porsche y F-16 («como un proyecto de Blender, con texturas en cada pieza, nada simplificado»; se pueden subir los límites de rendimiento si hace falta).
  2) Sonido de los tres (el F-16 no tiene ni botón de sonido en su HUD).
  3) Bug del cuadrado negro intermitente en la zona H2R/Porsche.
  4) Conducción muy profunda de los tres; la moto no debe poder caerse al girar (límite de inclinación).
  5) Pasada profunda por el entorno y las físicas.
- **Diagnósticos hechos (solo lectura). Resultados completos en el repositorio: `docs/diagnostico-2026-10-04/` (empieza por su `LEEME.md`); los JSON traen archivo:línea, cifras y el plan de arreglo, y `prototipos/h2rBike2.js.txt` es la moto sin caídas. Ningún archivo del simulador se ha cambiado todavía. Resumen:**
  - **Cuadrado negro, causa confirmada:**
    - Triángulos de área cero con normales (0,0,0) en el splitter del Porsche (`buildSplitter`, `gt3rs.js` ≈1655-1665: el contorno se recorta con `Math.min(halfW(x)*0.97, W)` y deja puntos colineales en z = ±0,825 m) dan píxeles NaN (`normalize(vec3(0))`).
    - El filtro de luciérnagas antes del bloom (`main.js` ≈330-340) deja pasar el NaN (`m > uPeak` es falso con NaN) y convierte Inf en NaN.
    - El bloom extiende ese píxel a un rectángulo negro que parpadea al moverse la cámara.
    - Arreglo: un filtro a prueba de NaN/Inf, y quitar los triángulos degenerados (splitter, habitáculo, aberturas, volante, pianos y el Roadster tienen más).
  - **H2R:** con ayudas, 193 de 200 recorridos aleatorios de 30 s acababan en caída. Causas:
    - guiñada cinemática del contramanillar contada como demanda del neumático;
    - ABS y control de tracción que no respetan el presupuesto de agarre en inclinación;
    - cambios de superficie;
    - vallas hechas de círculos que dan choques frontales falsos al rozar.
    - Hay un prototipo con 0 caídas (`diag/h2rBike2.js`): presupuesto de agarre con prioridad lateral, tope de inclinación (estribera a 59,9°) y la moto se abre en vez de caerse.
    - Otros: en parado y en marcha alta arranca en sexta; `downshiftRpm` sin usar; la «ABS» es una ayuda del simulador (la H2R no lleva KIBS: verificar).
  - **Porsche:**
    - volante con teclado que pide el doble del ángulo útil;
    - DRS que se abre en mitad de curva;
    - PDK con corte total de 0,1 s, sin kickdown y sin mapa por carga;
    - subviraje fuerte en el límite;
    - diferencial viscoso en vez del autoblocante electrónico, con la inercia del motor sumada a cada rueda;
    - mando sin suavizar;
    - ABS que vibra a ≈22 Hz;
    - diámetro de giro de 11,1 m (publicado: 10,5).
  - **Sonido:**
    - explosiones redondeadas a muestras enteras (≈ −25 dB de ruido, la principal fuente de «arenilla digital»);
    - silbido de la válvula de alivio de la H2R roto tras ≈30 s;
    - sin modelo espacial (Doppler, distancia, reverberación) y la H2R ignora la cámara;
    - controles a frecuencia de fotograma que dan clics.
  - **F-16:** diagnóstico guardado en `diag-backup/f16-*.json`.
  - **Sin hacer:** modelos (detalle y presupuestos) y entorno/físicas.
- **Orden para continuar la pasada decisiva (recomendada):**
  1. **Cuadrado negro primero** (un commit pequeño y seguro; el plan, el código del shader, el saneador y las dos pruebas de regresión están en `cuadrado-negro.json`, campo `plan`).
  2. **Conducción de la H2R:** aplicar el prototipo (`h2rBike2.js.txt`) sobre `src/sim/h2rBike.js`, con sus pruebas en `tools/h2r-check.mjs` (nada de caídas al inclinar ni al frenar inclinado; sí con valla de frente o 0,6 m de agua). Reajustar a la vez altura del centro de masas, caballito y pérdidas para acercar el 0–100 a 3,1 s sin romper los otros tres tiempos de MOTORRAD.
  3. **Conducción del Porsche** (`conduccion-porsche.json`): volante, DRS automático, PDK, equilibrio, diferencial, mando.
  4. **Sonido** (`sonido.json`, `f16.json`): tiempo fraccionario de las explosiones, chirrido de la H2R, modelo espacial; **sonido y botón de sonido del F-16**.
  5. **Modelos hiperrealistas y entorno/físicas:** **los diagnósticos de estos dos frentes no se hicieron**; empieza por ellos (ver el encargo arriba). Límites de `tools/check.mjs` (`LIMITS`), subidos el 04-10 por orden del usuario («si el presupuesto está al límite se ajusta más alto, nada de bajar la calidad»): 4,5 M triángulos, 2.200 mallas, 340 materiales y 220 texturas. Y `core/lod.js`.
  - Norma de trabajo: bloques pequeños, `check:static` antes de cada commit, push a las cinco ramas más la de la sesión, `npm run check` al cerrar el bloque, y vigilar CI. Los agentes en paralelo se agotaron la cuota de la sesión una vez: cada agente debe terminar pronto y su resultado guardarse en el repositorio.
- **Peticiones del usuario aún abiertas (ambición máxima, «me da igual el tiempo»):**
  - Que la H2R y el Porsche sean idénticos a los reales en modelo, conducción y sonido. Ambos están muy mejorados, pero se puede afinar más.
  - H2R: alas, cúpula, cuernos, morro, tija y tapas del motor hechos (tercera sesión). Quedan: lado izquierdo del motor (compresor, tapas), basculante, tapa lateral bajo el asiento con su hueco triangular, chasis con más tubos (foto cenital sin carenado).
  - Porsche: cortinas de aire del frontal, aletas del difusor, salpicadero y habitáculo, y reflejos de la pintura. La conducción con teclado se puede seguir puliendo.
- **Otros pendientes:** F-16 H17 (supersónico con datos); auditoría visual y de vuelo del F-16 (opcional); P1 de la auditoría (abajo). **La galería no se regenera sin aprobación del usuario.**
- **Ojo, la carpeta temporal se pierde entre sesiones.** Allí estaban las fotos de referencia (Porsche newsroom, Kawasaki), las cámaras calibradas y los bancos de pruebas (`bench/`, `match/`, `hb/`), y no están en el repositorio. Las fotos se usan solo como referencia y nunca se suben. Si hacen falta, vuelve a descargarlas y rehaz el banco: una página que cargue solo el vehículo y lo renderice con la cámara ajustada a la foto, más una superposición de bordes.
- **Entorno del contenedor (sesión del 03-10, segunda):**
  - Al empezar: `npm ci`; para el banco de pruebas, `pip install pillow numpy opencv-python-headless`.
  - Red completa: kawasaki.eu, newsroom.porsche.com (la raíz da 503 a agentes genéricos; `/en.html` con agente de navegador da 200) y files.porsche.com responden.
  - **Wikimedia:** su API (`/w/api.php` de Commons y Wikipedia) devolvía 429 a todo. upload.wikimedia.org sí descarga, con la ruta `/wikipedia/commons/thumb/<md5[0]>/<md5[0:2]>/<nombre>/1280px-<nombre>`, donde md5 es el del nombre del archivo con guiones bajos. Despacio, con unos segundos entre descargas.
  - Fotos libres de la H2R en Commons: `Kawasaki_Ninja_H2R_right.JPG`, `_front.JPG`, `_front_left.JPG`, `_front_left_2.JPG`, `_half-cowl.jpg`, `_exposed_left_front.JPG`, `_exposd_right_front.JPG`, `_exposed_left_rear.JPG`, `_exposed_top_right.JPG`, `_engine.jpg`, `2019_Kawasaki_Ninja_H2R_FOS19.jpg`, `_Petersen_Automotive_Museum.jpg`, `_at_the_Tokyo_Motor_Show_2015-1/-2.jpg` y las del Mondial de Paris 2018 `-001/-002/-003`.
- **Banco de pruebas aislado (recrearlo en la carpeta temporal, nunca en el repositorio: eslint y `provenance-check` escanean el árbol):**
  - Un servidor Node propio que sirva el repositorio en `/` (con `tools/static.mjs`) y la carpeta del banco en `/bench/`.
  - Una página con importmap a `/vendor/three` que construya solo el vehículo: `buildH2r(M)` no necesita `createMaterials`; `buildGt3rs` sí (`M = await createMaterials()` de `src/materials/library.js`).
  - `window.render({ pos, target, fov, up, w, h, hide, normals })` devuelve un JPEG.
  - `vendor/three` no incluye `RoomEnvironment`: el entorno de estudio se hace con una caja gris y planos emisivos más `PMREMGenerator.fromScene`.
  - Chromium con `--use-gl=angle --use-angle=swiftshader`.
- **Lecciones de esta sesión:**
  - **Comprobación por niveles (orden del usuario del 03-10-2026):** `npm run check:static` (≈2–3 min) antes de cada commit; el `npm run check` completo (≈25–30 min) una vez al cerrar cada bloque o al final de la sesión, en segundo plano y sin editar el repositorio mientras corre. CI ejecuta el check completo en cada push y no despliega si falla: vigila que salga en verde.
  - Antes del check, guarda `git write-tree` y compáralo justo antes del commit.
  - Una prueba con esperas fijas puede fallar bajo carga: espera a una condición (`waitForFunction`).
  - En `gt3rs.js` las regiones del cuerpo se cortan sobre una rejilla. Un borde inclinado en x deja escalones; un borde por banda del parámetro t sale limpio.
  - Para importar módulos del repositorio desde Node fuera de `tools/`, usa `registerHooks`, que resuelve `three` a `vendor/three`.

### Histórico (02-10-2026: F-16 volable con mandos sencillos; Porsche conducible con PSM y derrape con Espacio; galería regenerada el 02-10; auditoría de ChatGPT del 02-10: P0 corregidos, P1 mayores pendientes)

### Proyecto en curso: F-16A Block 15 volable (desde el 01-10-2026)

El X-15 se construyó y se retiró (commits `5f77233`–`f688ba8`; la razón está en el README, *El X-15 se retira*). Decisiones del usuario para el F-16:
- **Caza:** F-16A Block 15 (motor F100-PW-200), elegido por los datos públicos que tiene.
- **Despegue:** parte de su propia pista, con su tren de ruedas. Despega, vuela y aterriza **sin cambios de plano**: siempre en el entorno de la simulación, nunca en otro escenario. Nada de B-52 ni de suelta.
- **Entorno:** se amplía el actual (llanura, lomas, costa, Golfo) hasta ≈100–150 km, con el mismo estilo y menos detalle a lo lejos. **Nada de imagen de satélite**: al usuario no le gustó.
- **Complejo:** una pista «con algún detalle», **sin aeropuerto**.
- **Al acabar:** actualizar el README y hacer commit de cada fase seguida, sin pararse a preguntar. **La galería no se regenera hasta que el usuario lo confirme** (orden del 01-10-2026, que sustituye a la aprobación anterior).

Fases, cada una un commit con check a 0, empujado a las cinco ramas (las cuatro de abajo y `claude/affectionate-euler-o447rh`):
1. Quitar el X-15: **hecha**, commit «Retire the X-15».
2. Entorno ampliado: **hecha**, commit «F-16 phase 2: the surroundings out to 450 km». `src/core/outerGround.js` (anillo de tierra y mar con el material del disco, curvatura `curvatureDrop`), `groundSample` en `environment.js`, `env.outer` (oculto en lanzamiento, reentrada y órbita, desde `main.js`) y `env.setAltitude(h, { flight: true })` (bruma de vuelo, sin estirar el disco).
3. Modelo 3D exterior: **hecha**, commit «F-16 phase 3: exterior model from NASA's geometry».
   - Código: `src/data/f16.js` (cifras con su etiqueta PUBLISHED/DERIVED/TRACED/ESTIMATE), `src/vehicles/f16.js` y `src/materials/f16Textures.js`.
   - Marco: s = metros detrás de la punta de la sonda, z sobre WL 6,607. `P(s, z, y)` lo pasa a la escena.
   - Bisagras con `userData.hinge` (eje y recorrido): `f16-lef-*`, `f16-flaperon-*`, `f16-stab-*`, `f16-rudder` y `f16-speedbrake-*`. El tren es `f16-landing-gear`.
   - La pista ya existe como máscara del terreno (`RUNWAY`, `toRunway` y `fromRunway` en `terrain.js`: 2.743,2 × 45,72 m, a 30°). El avión está a 40 m del umbral de la 13 (en la fase 7 la pista pasó a ser la 10/28 y se acercó al recinto).
   - Las capturas de comprobación se hacen fuera del repositorio. La galería **no se regenera hasta que el usuario lo confirme**.
4. Complejo de la pista: **hecha**, commit «F-16 phase 4: runway 13/31 with FAA markings».
   - `src/core/runway.js`: `buildRunway(M)` y `runwaySurface(a, c)`, la altura del pavimento en coordenadas de pista. Sirve para posar el avión y, en la fase 5, para el contacto de las ruedas.
   - Marcas según la FAA AC 150/5340-1M, descargada a la carpeta temporal.
   - En coordenadas de pista, +c queda a la derecha de +a, hacia el suroeste. El comentario antiguo de `terrain.js`, que decía noreste, se corrigió.
5. Modelo de vuelo: **hecha**, commit «F-16 phase 5: six-degree-of-freedom flight model».
   - `src/sim/f16Flight.js`: `createF16Flight({ ground })` devuelve `{ state, input, reset, advance, pose }`.
     - `ground(x, z)` → `{ h, hard, water }`.
     - `input` = `{ pitch, roll, yaw, throttle, brake, speedBrake, gearDown }`.
     - `pose()` da la posición y el giro del origen del modelo (la punta de la sonda, el suelo en y = 0); el centro de gravedad está en `CG`.
   - Datos en `src/data/f16Aero.js`: los polinomios de Morelli (NTRS 20040110310, descargado a la carpeta temporal), la tabla VI y `FCS`.
   - `tools/f16-check.mjs` forma parte de `check:static`; también `npm run check:f16`.
   - Lecciones del ajuste:
     - La ley C* manda velocidad de cabeceo por debajo de 122 m/s: el piloto automático de la prueba sigue α con la palanca y la senda con el motor.
     - Bajar el amortiguamiento de cabeceo o subir el integrador hace que el avión se vaya en pérdida profunda (α de 111°).
     - En un alabeo rápido, la deriva β se convierte en α (α̇ ≈ q − pβ): por eso existe la realimentación de β.
6. Modo de vuelo: **hecha**, commit «F-16 phase 6: fly it from runway 13».
   - `src/sim/f16Fly.js`: `createF16Fly({ scene, exhibit, env, rig, camera, ground, hud })`.
     - El airframe pasa a un `holder` en la escena mientras vuela y vuelve a su padre al terminar.
     - `state.manual` permite a las pruebas fijar `pilot` sin leer el teclado.
   - `src/ui/f16Hud.js`: lienzo del HUD y barra con los botones.
   - En `main.js`:
     - `f16Ground` (pista → terreno → mar, con `curvatureDrop`);
     - `toggleFly` (tecla J y botón *F-16 · Fly*);
     - `sequences.f16`, que entra en `anyFlying` y en `enforce`;
     - la clase `is-f16` del `#hud`.
   - Mientras vuela, el teclado es del avión: `onKeyDown` en captura detiene todos los atajos salvo H y ?.
7. Revisión: **hecha**, commit «F-16 phase 7: review».
   - Freno de estacionamiento al empezar: al ralentí el F100 empuja más de lo que frena la rodadura, y el avión avanzaba solo.
   - Al volver a rodar tras parar, el cartel «Landed» se retira.
   - La velocidad del HUD es la calibrada de verdad (`calibrated(M, P)` en `f16Fly.js`), no la equivalente.
   - Corrección tras probarlo el usuario: el vuelo corre con `steps.mission` (tiempo de pared, máximo 0,5 s por paso), no con `steps.view` (máximo 0,05 s), que lo ponía a cámara lenta por debajo de 20 fps. `ux-check` lo comprueba.
   - Mandos simples por petición del usuario («demasiado complejo»): `easyControls` en `f16Fly.js`, activo por defecto (`state.assist`); el botón *Simple* de la barra vuelve a los mandos completos. W despega/morro abajo, S morro arriba, A/D inclinación (ver abajo), G tren; el motor y los frenos son automáticos.
   - Segunda ronda tras probarlo el usuario («no me gusta lo de la estabilidad», «muy difícil girar», «la pista exageradamente lejos», «mejora el modelo»):
     - **Viraje directo** en `easyControls`: A/D cambian `bankCmd` a 90°/s (±80°), que se mantiene al soltar; sin nivelar alas ni mantener altura. Si al soltar la orden se aleja más de 25° de la inclinación real, se iguala a ella.
     - **Pista 10/28** (`RUNWAY` en `terrain.js`: 0°, 2.438,4 m, centro (−1000, 500), `idents`). El avión espera en la cabecera 28 (+a). `runway.js` dibuja los numerales de `RUNWAY.idents`. Se eligió con un script de búsqueda que está en la carpeta temporal: la línea llana más cercana a la fila.
     - **Modelo:** `buildNozzle` (tobera maciza, citando la foto de dominio público de la USAF), `buildBooms` con `BOOM` (carenado y pétalos de concha; el eje de bisagra es `[0, 0, -up]` en los dos lados) y tren detallado (`wheel`, `strut`, `torqueLinks`, vástagos con `M.aluminum` para no pasar de 200 materiales), sondas de α y antenas.
     - **Lección:** en `LatheGeometry`, llama a `computeVertexNormals()` antes de `outward()`, porque sus normales analíticas no siguen el orden de los vértices, y dibuja un borde que mira hacia atrás como `RingGeometry` aparte.
     - **Siguiente vehículo (orden del usuario):** Porsche 911 GT3 RS (992, 2023, 525 CV); desde el 02-10 lleva el gris casi blanco y las llantas rojas de las fotos de estudio. Conducible con las cifras reales de aceleración, frenada y velocidad, con un circuito realista y una explanada pequeña de asfalto, y derrapes que dejen marcas.
   - **Galería regenerada el 02-10-2026** con la aprobación del usuario («Regenera todo y actualiza todo»). `tools/docs-shots.json` lleva el F-16, la pista, el vuelo, el Porsche y el derrape (campo `play` de `shot.mjs`).

Fuentes descargadas para consulta, fuera del repositorio (en la carpeta temporal de la sesión; se pueden volver a bajar de NTRS):
- **NASA TP-1538** (Nguyen et al., 1979), NTRS 19800005879: tabla I (peso 20.500 lb; Ix 9.496, Iy 55.814, Iz 63.100, Ixz 982 slug·ft²; envergadura 30 ft, 300 ft², cuerda media 11,32 ft; centro de gravedad de referencia 0,35 c̄), tabla III (aerodinámica, α −20…90°, β ±30°), tabla VI (empuje en ralentí, militar y máximo, de 0 a 50.000 ft y de Mach 0,2 a 1,0) y apéndice A (mandos de vuelo).
- **NASA TP-3355** (1993), NTRS 19930022544: F-16C y un derivado, de Mach 1,6 a 2,16, con planos de tres vistas.
- **Hueco:** no hay datos públicos del F-16 en la zona transónica (Mach 0,6–1,6), ni de empuje por encima de Mach 1. Habrá que interpolar y marcarlo como ≈.


### Proyecto en curso: Porsche 911 GT3 RS (desde el 02-10-2026)

Orden del usuario: el siguiente vehículo es un Porsche 911 GT3 RS real (992, 2023, 525 CV) en Arctic Grey, con la misma estructura que los demás (hiperrealismo, información y fuentes). Debe ser conducible con la aceleración, los frenos y la velocidad reales, tener un circuito realista y una explanada pequeña de asfalto, y dejar marcas de neumático al derrapar.

Fases, un commit cada una:
1. **Datos, circuito y explanada: hecha.**
   - `src/data/gt3rs.js` reúne las cifras de la ficha técnica oficial de Porsche (MY P 08/2022) y del dossier de prensa, descargados a la carpeta temporal.
   - `src/core/circuitPlan.js` define el trazado (rectas y arcos), `trackCoords`, `skidpadDistance` y `circuitMask`.
   - `src/core/circuit.js` construye las mallas y exporta `circuitSurface` y `CORNERS`.
   - Marcos: el local (u, v), con u a lo largo de la recta principal y v hacia la derecha, y el mundo, con x = −675 − v y z = −375 + u. La vuelta va a +v.
2. **El coche y la conducción: hecha.**
   - **Modelo:** `src/vehicles/gt3rs.js`.
     - Superficie maestra `bodyPoint(x, t)` con el marco X adelante, Y arriba y Z a la derecha, centrado en la batalla.
     - `region(x, t)` decide qué material va en cada sitio; `endCap` cierra el morro y la cola.
     - Faros con `onFront` (método de Newton), juntas con `lineOnBody` y la carrocería en el grupo `gt3-sprung`.
     - Ruedas `gt3-wheel-fl/fr/rl/rr`, con su grupo de giro en `userData.spin`; el flap del DRS es `gt3-wing-flap`.
   - **Dinámica:** `src/sim/gt3Car.js`.
     - `createGt3Car({ ground })` devuelve `{ state, input, reset, advance, step, worldOf, WP }`.
     - `ground(x, z)` → `{ h, mu, roll, kind }`.
     - Ajustes estimados: μ 1,48, rendimiento 0,88 y CdA 0,89. Con ellos se clavan las cifras de Porsche (ver `tools/gt3rs-check.mjs`).
   - **Conducción:** `src/sim/gt3Drive.js` (marcas en un búfer circular de 12.000 quads) y `src/ui/gt3Hud.js`. En `main.js`: `gt3Ground`, `toggleDrive` (tecla B), `sequences.gt3` y la clase `is-gt3` del `#hud`.
   - **Lecciones:**
     - Las ruedas se integran de forma implícita, porque la fuerza longitudinal es demasiado rígida para un paso explícito.
     - La resistencia a la rodadura va a la carrocería y no a la rueda, porque si no la hace girar.
     - El cambio necesita histéresis.
     - `setIndex` no acepta arrays tipados.
     - Los bordes inclinados necesitan filas densas en su banda.
3. **Revisión: hecha.**
   - Las tapas planas llevan sus piezas como placas (`facePlate`, `buildFacePlates`).
   - Los cristales laterales tienen juntas a lo largo de sus bordes exactos.
   - La lente de los faros es más discreta.
   - Las marcas de neumático son de doble cara (`DoubleSide`: sus quads giran con el sentido de la marcha).
   - Hay humo de neumáticos (`createTyreSmoke` en `gt3Drive.js`, puntos con shader propio).
   - La vista *The circuit* está corregida.

4. **Mejora absoluta (orden del usuario del 02-10-2026):** «Haz el 911 GT3 hiperrealista, mejora absoluta… nada de simplificar el modelo. Añade también todo eso que dices» (retrovisores fieles, habitáculo, sonido del motor y la parada en la visita guiada). Subfases, un commit cada una:
   1. **Referencias y carrocería: hecha.**
      - Fotos de prensa de Porsche solo como referencia, en la carpeta temporal. Cámaras ajustadas: lateral (plano medio 191 px/m, ruedas 203, cámara a 13,5 m y 0,65 m de altura: `px = 693 − x·2580/(13,5 + z)`), frontal `{xc 12,28, hc 1,56, f 3159, cx 563,5, cy 167,8}` y trasera `{xc −9,9, hc 1,304, f 2103,7, cx 555, cy 184,7}`, sobre la imagen a 1.400 px.
      - Sección de 15 puntos (`hipZ/hipY` nuevas). La base de las ventanillas está a ≈0,885 m (la foto con su cámara); la cadera y el hombro bajaron para dejarla ahí.
      - Ventanillas por alturas trazadas (`DLO`), con su marco negro y el montante B en −0,52…−0,58.
      - Morro y cola: caras redondeadas (`endCap` con perfil `bulge·(1 − f^m)^½`, tangente a los costados); las placas se pegan encima con `facePatch` y `faceX`.
      - Piezas sobre la superficie con `bandPatch`, `loopPatch`, `loopWall` y `bodyFin` (vistas `side` en (x, y) y `plan` en (x, |z|), invertidas con `tAtY` y `tAtZ`). Contornos densificados: si no, el parche se hunde bajo la pintura.
      - Puerta (borde delantero 0,66, trasero −0,58, abajo 0,27), tiradores, retrovisores (`MIRROR`), tomas traseras, lamas de las aletas, salidas del capó con rejilla (`M.honeycomb`, `makeHoneycomb`), láminas negras delante y detrás de la rueda delantera, intermitente ámbar, salida tras la rueda trasera, aletas del techo, limpiaparabrisas, tapón del depósito (aleta delantera derecha) y pasos de rueda negros.
   2. **Ruedas, frenos, ala, habitáculo, sonido y visita: hecha** (un solo commit).
      - `buildWheel` (radios en Y con `facesGeo`, `tyreGeo` con ranuras, `drilledDisc`, pinza extruida); `M.gt3WheelDS` para el barril, visto por los dos lados.
      - `buildWing` con `WING.plate` (derivas) y la silueta de los cuellos; el borde superior de todo el conjunto se ajusta a 1,322 m.
      - `buildCabin`: salpicadero extruido, cuadro con textura de lienzo (`clusterTexture`, solo en el navegador), volante en su marco local inclinado 22°, baquets, cinturones, consola y jaula. El revestimiento interior se recorta en los cristales y lleva molduras interiores (`lineOnBody` con lift negativo) a lo largo del contorno.
      - `src/sim/gt3Sound.js`: `createGt3Sound()` → `{ enabled, setEnabled, update(state, input, surface), stop }`. Tecla M en `gt3Drive.js`, botón `#gt3-sound` en `gt3Hud.js`.
      - Cuatro paradas `gt3rs` al final de `TOUR` en `main.js` (overview, side, rear y wheel), validadas por `provenance-check`.

### Conducción del Porsche y vuelo del F-16, revisados (02-10-2026, orden del usuario)

El usuario pidió:
1. corregir la conducción del Porsche: derrapes exagerados, derrapes al frenar, y derrapar con la barra espaciadora;
2. corregir el vuelo del F-16, «realista pero sencillo y divertido»: era imposible despegar y se chocaba con la pista;
3. una pasada exhaustiva a cada vehículo, uno a uno, despegues de Starship incluidos.

Lo hecho en 1 y 2 (detalle en el README, sección del 2 de octubre):
- **Porsche** (`gt3Car.js`):
  - `s.tc` es ahora el PSM, encendido por defecto, con control de estabilidad (`s.esc`, `escBrake`, `escKeep`);
  - ABS continuo (`s.absK`), EBD y control de frenada en curva;
  - `AXLE_MU` y `AXLE_ALPHA` por eje;
  - derrape con freno de mano (`s.drift`, con ayuda antitrompo solo con PSM);
  - `steerReach(s, dir)` para el teclado (círculo de fricción, contravolante solo hacia el derrape).
  - Pruebas en `gt3rs-check.mjs` («Driven as the keyboard drives it») y en `ux-check`.
- **F-16:** mandos sencillos en `src/sim/f16Assist.js` (`createF16Assist`, `calibrated`, `attitude`), que `f16Fly.js` usa.
  - Teclas: W/S potencia, ↑/↓ trayectoria, A/D alabeo con nivelación.
  - Ayudas: Auto-GCAS, autoacelerador a 150 kt con el tren abajo, recogida.
  - Bucle exterior en términos de C*.
  - En `f16Flight.js`, la amortiguación de cabeceo en tierra baja de 3,0 a 1,2.
  - Pruebas «mandos simples» en `f16-check.mjs`, y en `ux-check`.

- **3, pasada vehículo a vehículo:** hecha. Correcciones en el README («Pasada vehículo a vehículo»):
  - nube de suelo (`CLOUD_FRAG` en `plume.js`);
  - `hideSite` de `reentry.js`, que ahora oculta también `runway-complex` y `circuit`;
  - vuelco tras el amerizaje (`reentryPitchAt` y la posición en `reentry.js`);
  - vista del corte del Falcon 1;
  - texturas `makeRoadPaint` y las grietas de `makeAsphalt`.
  - Los guiones de captura se hacen fuera del repositorio con `frames.mjs`.

### Galería regenerada (02-10-2026, orden del usuario: «Regenera todo y actualiza todo»)

- Se ejecutaron `npm run shots` (`docs/screenshots`), `docs/hud` y `docs/review-sun18`, y el README lista todas las capturas.
- `tools/shot.mjs` admite `play: { mode: 'f16' | 'gt3', steps: [[teclas, s], …], camera }`. Tras el guion congela la simulación (si no, el bucle de la página seguía conduciendo en tiempo real mientras se estabilizaba la interfaz) y la libera en la captura siguiente.
- `tools/hud-shots.json`: el dock de vehículos solo aparece ya en el modo de escena limpia, así que se quitaron los clics a `#dock-vehicles`, la escena limpia se activa con `#clean-btn` y se eliminaron las capturas `*-views` y `*-tools` de tableta y móvil (sus vistas ya no existen). Las de tableta y móvil enseñan paneles solapados: es lo esperado desde que la web es solo para ordenador (28-09), no una regresión.
- Corregido de paso: el cuadro del Porsche se dibujaba encima de la barra de botones; ahora se coloca por encima de ella.
- La regla sigue: no regenerar sin aprobación expresa cada vez.

### Auditoría técnica de ChatGPT (02-10-2026, sobre `8e595b8`; detalle en el README, sección *Auditoría técnica externa del 2 de octubre de 2026*)

- 60 hallazgos H01–H60.
- **Hechos**, cada uno con su prueba:
  - Porsche:
    - H01 reloj con acumulador;
    - H03 reset completo;
    - H04 cargas que conservan el total;
    - H11 arrastre vectorial y velocidad sobre el suelo;
    - H12 entradas no finitas;
    - H47 humo por segundo;
    - H48 sonido con la pestaña oculta.
  - F-16:
    - H13 alabeo ±180° con `atan2`;
    - H14 tierra/mar antes de la curvatura (`src/core/f16Ground.js`);
    - H18 atmósfera de 1976 hasta 86 km;
    - H21 tren limitado a ≈300 kt;
    - H22 reset completo;
    - H23 mando de juego en los mandos sencillos;
    - H36 curvatura finita;
    - H60 vectores de trabajo por instancia.
  - H24: con la guía abierta, el teclado es de la guía.
  - Flight 14:
    - H35 salto de 380 m en la entrada;
    - H27 captura «hypothetical» con `src: 'scenario'`;
    - H26 recuentos planificados frente a los del vuelo 14 en `BOOSTER_COUNTS` y en el panel.
  - Herramientas, servidor y licencias:
    - H43 perfilador con un solo reinicio por frame;
    - H52 CRLF en los controles negativos;
    - H55 servidor local confinado (`tools/static-check.mjs`);
    - H56 licencia OFL de IBM Plex;
    - H51 diagnóstico del clic intermitente, con causa NO VERIFICADA;
    - H57 descripción de `package.json`.
- **Baterías nuevas en `npm run check:static`:** `tools/mission-check.mjs` y `tools/static-check.mjs`.
- **No verificado:** el Raptor Vacuum apagado en el ascenso que cita la auditoría. La página de SpaceX no se pudo leer (se genera con JavaScript), así que no está en el panel.
- **Pendiente (P1+, cambios grandes; pedir prioridad al usuario):**
  - Porsche: suspensión y contactos por rueda (H02); ayudas separadas de la física (H07); neumáticos, transmisión, dirección y aerodinámica activa (H05, H06, H08, H09); colisiones y agua (H10).
  - F-16: H15, H16, H19 (FLCS en `sim/f16Flcs.js`) y H20 hechos; queda H17.
  - Flight 14: H28, H30, H32 y H33 en parte hechos (plan, punto 4); quedan H29, H31 y H34.
  - Datos: procedencia por campos y validación independiente (H38, H39, H41, H50).
  - Rendimiento y estructura: arranque progresivo (H42, H44–H46), módulos grandes (H49); la telemetría accesible (H25) está hecha.
  - Repositorio y CI: pad (H37), ventana del Dragon (H40), CI entre navegadores y ramas (H53, H54), Three.js (H58), permisos del flujo de trabajo (H59).

### Porsche: copia visual del coche real (orden del usuario del 02-10-2026)

«Dale con los cambios grandes, ambición máxima… el modelo 3D del Porsche tiene muchos fallos, quiero que hagas una copia idéntica a nivel visual tanto por fuera como por dentro… además quiero que implementes otras mejoras muy grandes.» Plan, un commit por fase:
1. **Exterior: hecha** (commit «Porsche: new body against the four studio photographs»). Detalle en el README, *mejora 3*.
   - Banco de pruebas fuera del repositorio (carpeta temporal `bench/`): construye solo el Porsche y lo renderiza con las cámaras de las fotos (`match/cams.json`; q34 resuelta por PnP). `match/overlay.py` superpone los bordes. Las fotos de Porsche están solo en la carpeta temporal.
   - Extremos: `relief(spec)` con `NOSE`/`TAIL`; `endPatch`, `endBand` e `intake` sobre `ENDS[dir]`. `endNormal` estaba mal para la cola (componentes laterales invertidas): corregido.
2. **Habitáculo: hecho** (commit «Porsche: the new cabin with live instruments»). Está en `src/vehicles/gt3Cabin.js`: `buildCabin(M)`, `EYE` (el ojo del conductor, que usa `gt3Drive.js`) y `userData.instruments.update({ rpm, gear, kmh, steer })` en el grupo `gt3-cabin`. `gt3Drive.js` la llama en cada frame y al terminar. El banco de pruebas tiene `cab.html` y las vistas `drv`, `clu`, `seats` y `door`.
3. **Dinámica P1: hecha** (commit «Porsche: P1 dynamics»). `gt3Car.js` lleva `groundPlane()` (el suelo en las cuatro huellas), la suspensión (`hz`, `bp`, `br` y `travel`), el embrague (`clutchLocked`, `launch`), `steerW`, `aero`, `contacts()` con `obstacles(x, z)` y el agua (`wet`). Las ayudas están en `gt3Assists.js`. `main.js` pasa `gt3Obstacles` (los oclusores de los expositores).
4. **Flight 14: hecho en parte** (commit «Flight 14: one mission state from cutoff to entry»). `src/sim/mission.js` (`missionChain()`, `MU` común) da a `reentryFlight.js` su estado de entrada. El ascenso termina en la órbita circular de 200 km (`SHIP_ASSUMED.holdAltitude`/`perigee`). La reentrada se resuelve por Levenberg–Marquardt con semilla convergida y lleva `crossRangeBound`. Desfase medido: 22 min. Pendientes: H29, H31 y la dinámica del volteo.
5. **F-16 y telemetría: hechos** (commit «F-16: round-Earth frame, fuel and data domain; live telemetry»).
   - `f16Flight.js`: `geodesy(x, y, z)` da la altura sobre el mar y la normal; `s.alt`, `s.g` y `GEO` son por avión. `CONFIG` (configuración limpia, 3.100 kg ≈ de combustible, TSFC ≈) y `fuelFlow()`. `s.mass`, `s.fuel`, `s.flameout` y `s.domain` (fuera de los datos de Morelli o por encima de Mach 0,6).
   - `f16Fly.js`: la velocidad calibrada y la altitud usan `s.alt`. El HUD muestra FUEL, EXTRAPOLATED y FLAMEOUT.
   - `src/ui/telemetryList.js` (`createTelemetryList`), en `gt3Hud.js` y `f16Hud.js`, con la clase `.sr-only` de `styles.css`.
   - `gt3Hud.js`: `drawTelemetry` (trazas de 20 s y círculo g-g), muestreado con `r.t`, el reloj de la simulación.
   - Pendiente: H17 (supersónico con datos). H19 hecho (`sim/f16Flcs.js`).
6. Más mejoras propias dentro de las reglas.

### Orden del usuario del 02-10-2026 (segunda): todo el F-16 y el Porsche a fondo, físicas del mapa y la Ninja H2R

«Mejora al máximo todo lo del F-16 y el Porsche… arregla la similitud con el modelo real, el alerón se ve raro. Luego físicas reales del mapa: agua que se comporte como agua, desnivel, no atravesar vallas, vehículos ni estructuras, la nave cayendo al agua, choques realistas. Después, mejoras propias que impresionen. El nuevo vehículo será la Kawasaki Ninja H2R.»
- **Decisión del usuario:** H2R (no la H2 SX de la primera foto), en Mirror Coated Spark Black con chasis verde, **con sus rótulos de fábrica**. Es una excepción a la regla de logotipos, solo para esta moto.
- Plan: (1) Porsche contra fotos, **hecho en parte** (mejora 6 del README: alerón, llantas cóncavas, frontal en U, faros, zaga); (2) F-16 (puertas del tren corregidas con fotos de DVIDS; Wikimedia limita las descargas desde aquí: no insistir); (3) físicas del mapa, **hechas** (README, *Físicas del mapa*): `core/water.js`, `terrain.js` `poolShape`/`poolDepth`, `core/colliders.js` (mapa de celdas: `gt3Grid` en `main.js` al empezar a conducir, `f16Grid` al empezar a volar), agua en `gt3Car.js` (`s.water`, `s.immersion`, `s.flood`, `s.afloat`, `s.sunk`, `s.drowned`), salpicadura `createSpray` en `gt3Drive.js`; choques realistas, **hechos** (README, *Choques de verdad*): `core/effects.js` (partículas balísticas por tipo), `sim/gt3Damage.js` (aplastamiento ordenado contra un plano; `gt3drive.damage`, `gt3drive.fx`), `crashEffects`/`tendWreck` en `f16Fly.js`, agua balística `reentry-water` y espuma `reentry-foam` (sombreador; ojo: `patch` es palabra reservada en GLSL) en `reentry.js`; (4) mejoras propias; (5) la H2R, **rehecha** tras el «horrible» del usuario (README, *La Ninja H2R, rehecha*): `data/h2r.js`, `vehicles/h2r.js` + `h2rParts.js` + `h2rBody.js` (cámaras de las fotos ajustadas a la vez en la carpeta temporal `h2r/cal/ba.py`; contornos en píxeles de la foto lateral, `PXY`; volúmenes `shell`, pieles `skin`, rótulos `decal`), sin piloto (vista de sus ojos), `sim/h2rBike.js`, `sim/h2rRide.js`, `sim/h2rSound.js`, `ui/h2rHud.js`, `tools/h2r-check.mjs`; tecla N; expositor `h2r` junto al Porsche. Hecha y publicada (`098f64d`). Se puede seguir afinando con el banco aislado de la carpeta temporal (`hb/`: `node shot.mjs` con `view=cal&cal=cam_rf.json&model=new`, `sbs.py` foto contra render). Las fotos no van al repositorio.
- **Porsche, mejora 7 (03-10, tras la H2R; el usuario lo juzgó «deficiente» en modelado y conducción):** README, *mejora 7*.
  - Modelo:
    - llantas de radios en Y finos;
    - parte baja del frontal hundida (`NOSE_RECESS`, `intake(…, start)`);
    - faros con cuenco cromado;
    - rejilla del capó trasero y piloto central;
    - escapes de titanio oscuro;
    - toma de la aleta trasera más ancha;
    - lamas delanteras a ras;
    - parabrisas que rodea la esquina (`WRAP` en `inWindscreen`), con lo que el montante A ya no tapa la vista.
  - Conducción:
    - levas E/Q y G (`s.paddles`, `input.shiftUp`/`shiftDown`, `s.refused`);
    - cabeza del piloto sobre un muelle (`head` en `gt3Drive.js`);
    - cámara de persecución con sensación de velocidad;
    - sonido por AudioWorklet (`gt3-flat6`); `sound.update(s, i, surface, inside)`.
  - Banco de pruebas en la carpeta temporal:
    - `bench/shoot.mjs` con `--free v5.json` (vistas `whr`, `q34`, `lamp`, `tail`, `rearc`, `apil`) y `eye.json` (vista del piloto, con `tint` por malla para diagnosticar);
    - `match/match.mjs`, que ya oculta la H2R y las figuras, y respeta `up` de la cámara `q34`.
  - Pendiente posible: más detalle del frontal (cortinas de aire), del habitáculo (salpicadero) y del difusor.
- Banco de pruebas: `match/match.mjs` (en la app) da render y normales alineados con las fotos; `bench/shoot.mjs` vale para vistas libres, pero sus cámaras de foto con punto principal descentrado (frontal y trasera) no cuadran: para comparar, usa `match.mjs` + `overlay.py`.

### Al retomar

1. `git fetch --all` y comprueba:
   - que las cinco ramas (`claude/spacex-vehicle-center-3d-48zlkm`, `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo` y `claude/affectionate-euler-o447rh`) apuntan al mismo commit, el último con este TRASPASO;
   - que los últimos workflows de GitHub Actions pasaron;
   - que Pages sirve ese commit (`curl` a un archivo cambiado con `?x=<aleatorio>`).
2. Lee «Auditoría del 30-09» (abajo) y «Lo que NO se terminó», y espera a que el usuario diga qué priorizar.

### Auditoría del 30-09-2026 (hecha; detalle en el README, sección *Auditoría del 30 de septiembre de 2026*)

- **Estado de partida (`3a5bfb2`):**
  - ramas iguales, CI verde, Pages al día;
  - `npm run check` con código 0 en 19 min 43 s;
  - la cronología del vuelo 14 se leyó directamente en spacex.com (Chromium con la CA del proxy en NSS): todos los tiempos coinciden, y los 250 tf del Raptor están verificados.
- **Fallos corregidos en el commit de la auditoría:**
  - `launch.js`: `saveCameraPlanes()` **después** de `onStart()`, en `start` y en `seek`. Antes, G durante la reentrada dejaba el plano lejano en 1,7 × 10⁶ m para siempre.
  - `reentry.js`, `apply()`:
    - primero la cámara: `placeCamera` si `rig.external`; si no, `ride()`, la órbita montada en la nave;
    - después océano, `env.setAltitude`, globo y planos;
    - en pausa, `update` vuelve a llamar a `apply`;
    - `holdOrbitOnShip()` mantiene `rig.target` sobre la nave mientras manda el guion;
    - `setFollow` vuelve a tomar la cámara (`rig.external = true`);
    - `state.director` y `state.riding` van al HUD (*riding the ship*).
  - `main.js`:
    - `enforce()` también cierra la reentrada;
    - su `onState` restaura siempre el texto y el perfil del lanzamiento;
    - `verify()` la cierra;
    - C en la reentrada pasa a órbita.
  - `launch.start`, `launch.seek` y `reentry.start` pasan a modo órbita si se estaba paseando (60° de campo de visión). El vuelo libre se respeta: `check.mjs` exige que el lanzamiento pueda correr en él.
  - Persecución con `CHASE_DIP` = 12°: entre 16 y 27 km miraba el océano liso desde arriba.
  - **Alabeo** en `reentryFlight.js`: la sustentación se inclina para que la aceleración vertical no pase de −vh/30 s, y el planeo ya no rebota.
    - coeficientes vueltos a resolver: q = [0,003732, 0,7172, 0,002357];
    - pico de calentamiento a ≈71 km, ≈89 m/s en la caída en panza, encendido desde ≈843 m, ≈5 396 km.
  - Alerones: `FLAP_HEAT` 0xc7401c y k 0,35 (antes, naranja plano).
  - Fichas y encuadres:
    - encuadre `merlin` del Engine Row;
    - fichas de la costa (`Site · coastline`) y de la unión cápsula–trunk (fuentes `nasa_crs28_vertical` y `nasa_crew13_vertical`);
    - salvedad «Flight 14 as flown and as shown».
  - Limpieza:
    - código muerto fuera (`pitchTau`, `flightPathAt`, `buildHuman`, `WALL_ANGLE`);
    - `verify.js` importa `RVAC_HULL`;
    - `npm run serve` = `tools/serve.mjs`.
- **Pruebas nuevas:**
  - bloque *re-entry* en `cloud-check.mjs`, con el mutante `skip`;
  - bloque *Re-entry chapter* en `ux-check.mjs`: X desde el paseo, salto en pausa con control negativo, arrastre, C, G y tecla de vehículo;
  - el *fixture* de `cloud-check` lleva ahora `rig.mode = 'orbit'`.

### Qué es y cómo se trabaja (resumen; el detalle está en las secciones 0–5)

- Simulación web en Three.js de un museo de vehículos de SpaceX **a escala 1:1**, con el lanzamiento completo de Starship V3 desde el Pad 2 de Starbase. Repositorio `alvarodesigns34/spacex`, rama por defecto `claude/spacex-vehicle-center-3d-48zlkm`, web en https://alvarodesigns34.github.io/spacex/.
- **Reglas innegociables** (sección 0):
  - háblame siempre en español;
  - sin pull requests: el mismo commit a las **cinco ramas**;
  - comprobación por niveles: **`npm run check:static` con código 0 antes de cada commit**; el `npm run check` completo al cerrar cada bloque o la sesión; CI lo repite en cada push;
  - README en español, actualizado con cada cambio;
  - solo medidas verificables, con las aproximaciones marcadas (≈);
  - sin banderas ni logotipos, sin plataformas extra, sin modo noche, sin plantas ni objetos nuevos en el entorno;
  - galería solo con mi aprobación;
  - no eludir nunca protecciones antibots;
  - fotos con derechos, solo como referencia (nunca al repo);
  - mi email, nunca a servicios externos;
  - pie de commit: `Co-Authored-By: …` del sistema que te lo dé.
- **Depuración en el navegador:** `window.__vc` expone:
  - `jump(id, preset)` para los encuadres;
  - `launch.seek(t)`, `launch.start()` y `launch.reset(false)`;
  - `reentry.start()`, `reentry.seek(t)` y `reentry.setFollow('onboard'|'chase'|'director')`;
  - `rig.jumpTo(pos, target)`, `claimUserControl()`, `setToggle()`, `exhibits`, `scene`, `camera`, `composer`, `renderer` y `M` (materiales).

### Entorno local (Windows, sesión del 29-09)

- Clon en `C:\Users\preda\claudespacex\spacex`. En Windows **no hay Python**: sirve la web con `npm run serve` (`tools/serve.mjs`, en el repositorio desde el 30-09) → http://127.0.0.1:8080/.
- **Saltos de línea:** `core.autocrlf=false` y el árbol en LF, como en CI. Con CRLF, dos controles negativos de `tools/provenance-check.mjs` fallan porque buscan `\n`. Si ves decenas de archivos «modificados» sin diff, es solo el índice: `git update-index --really-refresh`.
- **Comprobación sin bloquear el trabajo:** `sh /c/Users/preda/claudespacex/sync-check.sh` copia HEAD más los cambios al worktree `C:\Users\preda\claudespacex\spacex-check` (con `node_modules` enlazado como *junction*) y ahí se corre `npm run check` en segundo plano. **Confirma exactamente lo verificado:** antes de hacer commit compara cada archivo con `cmp` contra la copia. En la sesión anterior se me escapó un commit incompleto (`445d522`) por añadir solo parte de lo verificado; lo arregló `6e4b0bd`.
- Para editar con scripts, usa archivos `.cjs` en el scratchpad: los heredoc de Bash con comillas simples y dobles mezcladas fallan.
- La última sesión usó el **navegador integrado** de la app de escritorio para ver la simulación e investigar (Claude in Chrome se desconectaba con esta página pesada). Usa el que tengas; si puedes navegar, lee las fuentes directamente.

### Hecho en la sesión del 29-09-2026 (todo en GitHub)

Commits, del más antiguo al más reciente, en las cuatro ramas; el detalle está en el README, sección *Ronda vehículo por vehículo del 29 de septiembre de 2026* y siguientes:

- **`258e8e8`**
  - **Raptor Vacuum** con tobera de «cubo» (foto de la NASA «A person viewing Raptor Vacuum», dominio público): tercio superior verde oliva, junta latón y extensión plateada de tubos (`makeRvacBell` en `textures.js`).
  - **Dragon:** banda de aluminio satinado en el pie de la cápsula y filete rojo pardo; panel solar continuo sobre respaldo oscuro (fotos de la NASA del CRS-28 y del Crew-13).
  - **Desvío final del propulsor:** el encendido de aterrizaje apunta ≈130 m mar adentro y los 3 motores centrales lo llevan a los brazos con una quíntica por eje, inclinándose hasta ≈15,7° hacia la torre, como en la foto del vuelo 5. Se nombra `DIVERT` en `launch.js`.
- **`04dfa0f`: Engine Row rehecha** con piezas de exposición (`engineExhibits.js`) a partir de los retratos oficiales (solo consultados):
  - **Merlin 1D Block 5:** tobera gris satinada con la garganta a ≈1,0 m (antes, 1,42 m), turbobomba, generador de gas, líneas trenzadas, mazos naranjas y placa de montaje azul;
  - **Raptor 3:** tobera carbón, collarín, anillos de cámara, disco del inyector, bloque de turbobombas, disco de empuje y conducto lateral;
  - **Raptor Vacuum** con esa misma columna;
  - `raptorStack.js` da la versión ligera a los 33 + 6 motores de los cohetes (204 000 triángulos frente a los 306 000 de antes);
  - `verify.js` mide el Raptor Vacuum por las mallas `rvac-bell`, `rvac-bell-inner`, `rvac-engineDark`, `rvac-engineSilver` y `rvac-enginePurple`.
- **`445d522` + `6e4b0bd`**
  - **Costa reorientada.** El mar estaba al NNE del pad. Ahora la playa, el mar, las dunas y las exclusiones se construyen en un **marco de costa** (`toCoast`, `fromCoast`, `seaward` en `terrain.js`) con la normal hacia el mar en ≈85,3° (Natural Earth, `data/gulf.js`), centrado en el Pad 2. El cohete sale sobre el mar y el propulsor vuelve desde él. Cuatro lomas que caían en el mar se movieron tierra adentro, y `ux-check` usa la loma de (−760, 200).
  - **Capítulo de reentrada del vuelo 14** (tecla **X**, botón *Reentry*):
    - tiempos citados de spacex.com (entrada T+9:28:56 … amerizaje T+9:50:30);
    - estado de entrada por vis-viva;
    - planeo integrado, con arrastre, L/D y arrastre de caída en panza resueltos por Newton;
    - plasma según Sutton–Graves, losetas y alerones brillando, estelas;
    - cámaras a bordo, de persecución y de boya;
    - amerizaje en océano abierto;
    - el panel de misión del HUD se reutiliza, con reloj en horas.
  - `FlightEarth` gana la opción `ocean`. `tools/shot.mjs` acepta `reentry` y `cam`, y en `tools/launch-shots.json` y `docs-shots.json` hay 7 capturas nuevas **aún no generadas**.
- **Commit de este traspaso:** además, dos retoques del HUD. Durante la reentrada se ilumina el botón *Reentry* (no *Launch*) y se oculta la leyenda «Booster» del perfil.

### Lo que NO se terminó

- **Galería:** regenerada entera el 02-10-2026 (lo de abajo es el procedimiento, ya ejecutado):
  - `npm run shots` (53 capturas);
  - `node tools/shot.mjs docs/hud tools/hud-shots.json`;
  - `node tools/shot.mjs docs/review-sun18 tools/sun18-shots.json --sun 18`;
  - añadir al README las 8 capturas nuevas (`reentry-onboard`, `reentry-plasma`, `reentry-bellyflop`, `reentry-flip`, `reentry-splash`, `engines-raptor`, `engines-merlin`, `launch-ship-cutoff`) y quitar el aviso de galería desfasada;
  - con SwiftShader son ≈30–60 s por captura.
- **Pasada final completa:** hecha en la auditoría del 30-09 (48 encuadres, 16 instantes del lanzamiento y 19 de la reentrada, sin errores de página). Los defectos que se vieron están corregidos.
- **Pendientes con evidencia por buscar:**
  - tercera ventana de la Dragon y pinzas del Falcon 1 en Omelek;
  - telemetría leída de las retransmisiones para contrastar los perfiles;
  - si el cabezal del Raptor 3 tiene partes plateadas visibles a contraluz;
  - **orientación del Pad 2: confirmada en espejo** (30-09, huellas de OSM leídas con la API, bbox −97,160/25,9945/−97,154/25,9985).
    - La conversión reproduce el modelo: torre (−25,5, −20,2) frente a (−23,8, −18,3); deluge (−104, 47) frente a (−107, 47).
    - Pero respecto a la geografía de la escena es una reflexión: los tanques del deluge están de verdad a ≈35–58° de la mesa y en el modelo a ≈256°; la torre, de verdad a ≈355° y en el modelo a ≈319°.
    - Arreglarlo es reflejar el pad respecto al eje de la zanja y girarlo ≈67,5° (eje real de la zanja a ≈123,3°, en el modelo a 190,8°), con las vistas `site`, los obstáculos, `towerToPad`, las pruebas y los encuadres.
    - **Espera la decisión del usuario.**
- **Ideas propuestas y no hechas:**
  - que los Merlin de los Falcon usen el perfil corto del Merlin de exposición. `merlinGeometry` (`engines.js`) sigue con el perfil antiguo, garganta a 1,42 m; `raptorGeometry` ya usa `RAPTOR3_BELL`, el de exposición. Hoy la mitad superior del Merlin queda oculta en el Octaweb y el hueco del escudo tendría que ajustarse;
  - sonido en la reentrada;
  - una parada de la visita guiada para la reentrada.

---

## 0. Reglas innegociables (léelas primero)

1. **Habla SIEMPRE en español conmigo.** Ni una palabra en inglés en mensajes, resúmenes, preguntas, avisos de progreso ni descripciones de comandos. Está en `CLAUDE.md` del repo y en mi `~/.claude/CLAUDE.md`. Excepciones:
   - el texto de la interfaz de la simulación sigue en inglés;
   - los comentarios del código siguen el estilo existente (en inglés);
   - los mensajes de commit se escriben en inglés, como todos los del historial.
2. **No crear pull requests.** Empujar siempre el mismo commit a estas **cinco ramas** (y a la de la sesión, si te asigna otra):
   - `claude/affectionate-euler-o447rh`
   - `claude/dreamy-bell-qn1eth`
   - `grok/sun18-audit-10c9929`
   - `claude/elegant-ptolemy-l99qgo`
   - `claude/spacex-vehicle-center-3d-48zlkm` (la rama por defecto; la que despliega Pages)
3. **Comprobación por niveles** (orden del usuario del 03-10-2026, sustituye a «el check completo antes de cada commit»):
   - **Antes de cada commit, `npm run check:static` tiene que terminar con código 0** (≈2–3 min: lint, procedencia y las pruebas de física de todos los vehículos).
   - **El `npm run check` completo** (≈25–30 min) se ejecuta una vez al cerrar cada bloque de trabajo o al final de la sesión, antes del último push.
   - **CI** (`.github/workflows/pages.yml`) ejecuta el check completo en cada push y no despliega si falla. Tras empujar, comprueba que todo sale en verde; si algo falla, arréglalo enseguida.
4. **Tras cada push, comprueba que GitHub Pages sirve la versión nueva:** https://alvarodesigns34.github.io/spacex/
5. **No regenerar la galería de capturas** (`docs/screenshots`, `docs/hud`, `npm run shots`) **hasta que yo lo apruebe explícitamente** en cada ocasión. Estado: ver la sección 4.
6. **Escala 1:1, solo medidas verificables, y las aproximaciones marcadas como tales** (≈, `approx: true`, «reconstruido»).
7. **Prohibido:**
   - banderas o logotipos nuevos;
   - plataformas de lanzamiento extra;
   - modo noche;
   - plantas u objetos nuevos en el entorno.
8. **El README se escribe en español y se actualiza con cada cambio.**
9. **Pie de los commits** (exactamente estas dos líneas al final del mensaje):
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: <la URL de la sesión que te dé el sistema>
   ```
   No pongas el identificador del modelo en ningún otro sitio (código, README ni resto del commit). Si el sistema te da otro pie de atribución, usa el que te dé.
10. **Nunca eludir Cloudflare ni protecciones antibots** al investigar.
11. **Fotos con derechos de autor** (NSF, etc.) se usan **solo como referencia visual**, nunca se añaden al repositorio.
12. **Mi email no se envía a servicios externos.** Por ejemplo, nunca en la cabecera User-Agent de peticiones a Wikimedia; usa una cabecera genérica como `Mozilla/5.0 (research script)`. Ya se coló una vez y no debe repetirse.

---

## 1. Qué es el proyecto

**SpaceX Vehicle Center 3D**:
- **Qué es:** una simulación web en Three.js (ES modules, sin bundler, `vendor/` con three) de un museo al aire libre con ocho expositores de SpaceX **a escala 1:1**, sobre un entorno costero tipo Boca Chica.
- **Repositorio:** `alvarodesigns34/spacex`. Trabajo local en `/home/user/spacex`.
- **Web publicada:** https://alvarodesigns34.github.io/spacex/

### Expositores (orden en el HUD; teclas 1–8, 0 = vista general)
1. **Starship V3** (Super Heavy Block 3 + nave) sobre una reconstrucción del **Pad 2 de Starbase**: mesa, zanja de llamas, torre con brazos de captura, granja criogénica, deluge. Incluye la **secuencia de lanzamiento completa**: cuenta atrás, despegue, max-Q, separación en caliente, boostback, regreso y captura del propulsor en la torre, con sonido sintetizado.
2. **Falcon 1** (configuración de 2008, con erector y torre umbilical de Omelek, corte educativo de la 2.ª etapa).
3. **Falcon 9** Block 5 (sobre su mesa con 4 pinzas).
4. **Falcon Heavy** (8 pinzas, 6 mástiles de cola).
5. **Dragon** (Crew Dragon con trunk, sobre adaptador cónico).
6. **Starlink** V2 Mini (sobre poste).
7. **Tesla Roadster** con **Starman** (vista «In orbit» con adaptador PAF y brazos de cámara selfie).
8. **Engine Row**: Merlin 1D, Raptor 3 y Raptor Vacuum sobre cunas.

### Estructura del código
- `src/main.js`: arranque, escena, disposición de expositores (`LAYOUT`: `x`, `z`, `mount`, `yaw`…) y `worldPreset()`.
- `src/vehicles/`: un builder por vehículo:
  - `starship.js`, `falcon.js`, `falcon1.js`, `dragon.js`, `starlink.js`, `roadster.js` (≈3 730 líneas), `enginehall.js`;
  - `engines.js`: geometrías de motores instanciadas (las de los cohetes);
  - `engineExhibits.js`: los tres motores de exposición del Engine Row; `raptorStack.js`: la columna del Raptor 3 (versión completa y ligera);
  - `pad.js`: Pad 2;
  - `padDressing.js` y `common.js`: mesas de los Falcon y utilidades.
- `src/sim/`:
  - `launch.js`: trayectoria, eventos, cámara, nubes, vapores;
  - `reentryFlight.js` (trayectoria de reentrada, pura y resuelta al cargar) y `reentry.js` (el capítulo: escena de origen flotante, plasma, cámaras);
  - `plume.js`: penachos, nube del suelo, `Glow`, `Vapor`, `EngineJets`;
  - `sound.js`: WebAudio sintetizado.
- `src/core/`:
  - `environment.js`: cielo, sol, niebla, altitud;
  - `terrain.js` (relieve, lomas, charcas y el marco de costa `toCoast`/`fromCoast`/`seaward`), `campus.js`, `clouds.js`, `backdrop.js`;
  - `lod.js`: nivel de detalle con histéresis;
  - `quality.js`: niveles high/medium/low;
  - `cameraRig.js`, `viewState.js`, `ao.js`.
- `src/materials/`:
  - `library.js`: materiales `M.*`;
  - `textures.js`: texturas procedurales en Canvas con UV métricas y `tileSize`.
- `src/data/`:
  - `specs.js`: fichas de datos y fuentes (`SOURCES`), presets de cámara por vehículo, `SOURCE_LABEL`;
  - `verify.js`: verificación dimensional, integridad de mallas e interfaces;
  - `falcon1.js`.
- `src/ui/hud.js`: interfaz.
- `tools/`: pruebas:
  - `check.mjs`: la principal;
  - `cloud-check.mjs`, `hardware-check.mjs`, `ux-check.mjs`;
  - `lod-pop.mjs`: mide el salto visual al cambiar de nivel de detalle (está en `npm run check`);
  - `profile.mjs`, `shot.mjs`, `census.mjs`, `static.mjs`…
- `.github/workflows/pages.yml`: valida con `npm run check` en `main`, `master`, `claude/**`, `codex/**` y `grok/**`, con una cola de concurrencia por rama, y despliega solo desde la rama por defecto.

### Objeto global de depuración (en el navegador): `window.__vc`
- `v.jump(id, presetId)` y `v.jump(null)` (vista general); `v.claimUserControl()`; `v.rig.jumpTo(pos, target)`.
- `v.launch.seek(t)`, `v.launch.setSpeed(0)`, `v.launch.reset(false)`.
- `v.lod.pin(name, true|false)`, `v.lod.update()`, `v.lod.forceDetailed()`, `v.lod.entries`.
- `v.exhibits[id].model`, `.lay`, `v.complex` (el Pad 2), `v.scene`, `v.camera`, `v.composer`, `v.renderer`, `v.setToggle('labels'|'ruler'|'humans', bool)`.

---

## 2. Cómo trabajamos (método)

- **Investigación profunda con fuentes primarias**:
  - spacex.com (incluido el artículo «Introducing Starship V3», 12 mayo 2026), guía de usuario de Falcon 2025, guía de Falcon 1 2008;
  - manuales oficiales de Tesla;
  - NASA (API `images-api.nasa.gov`; descargar por HTTPS desde `images-assets.nasa.gov/image/<id>/<id>~medium.jpg`);
  - NASASpaceflight (NSF), Wikimedia Commons (con `Special:FilePath/<archivo>?width=1280` y una cabecera genérica; tiene límite de peticiones).

  Cuando WebFetch da 403, uso un Chromium real (herramienta `_web.mjs`, anexo). Si dos fuentes chocan, manda la primaria. Si no hay cota publicada, hago **fotogrametría sobre fotos** (con un diámetro o ancho conocido como regla) y lo marco como aproximado.
- **Verificar visualmente cada cambio**: renderizo fotogramas con `_frames.mjs` y los reviso, con hojas de contacto (`sheet.py`) y recortes ampliados. Comparo con las fotos reales. No me conformo con que la prueba pase.
- **Auditorías externas**: el usuario me ha pasado auditorías de Grok y de ChatGPT. Contrasto cada punto con la fuente primaria y el código, implemento lo demostrable, rebato con pruebas lo que no se sostiene y no borro nada sin evidencia.
- **Comprobación completa** en segundo plano y consulta periódica:
  ```
  S=<scratchpad>; rm -f $S/check.log; (npm run check > $S/check.log 2>&1; echo "EXIT $?" >> $S/check.log)
  until grep -q '^EXIT' $S/check.log; do sleep 10; done   # (con timeout ≤ 590 s por llamada)
  ```
  **No edites archivos servidos mientras corre el check** (el servidor sirve en vivo).
- **Push a las cinco ramas con reintentos:**
  ```
  for b in claude/affectionate-euler-o447rh claude/dreamy-bell-qn1eth grok/sun18-audit-10c9929 claude/elegant-ptolemy-l99qgo claude/spacex-vehicle-center-3d-48zlkm; do for d in 2 4 8 16; do git push -q origin HEAD:$b 2>/dev/null && { echo "ok $b"; break; } || sleep $d; done; done
  ```
- **Comprobar Pages**: hacer `curl` a un archivo cambiado con `?x=$RANDOM` hasta que contenga el texto nuevo. El workflow tarda unos 12 minutos porque ejecuta el check antes de desplegar.
- **Estilo de respuesta que quiero**: en español, claro y honesto. Si algo falla, lo digo con la salida. Pequeños avisos de progreso mientras trabajas en tareas largas.
- **Entorno (solo en el contenedor en la nube; en local no aplica)**: Chromium en `/opt/pw-browsers`; no ejecutar `playwright install`. Para que Chromium navegue por el proxy hace falta la CA en NSS:
  ```
  apt-get install -y libnss3-tools   # si falta certutil
  mkdir -p /root/.pki/nssdb && certutil -A -d sql:/root/.pki/nssdb -n ccr-agent-proxy -t "C,," -i /root/.ccr/agent-proxy-ca.crt
  ```
  y lanzar con `proxy: { server: process.env.HTTPS_PROXY }`.
- **En la nube no había `gh` CLI**: GitHub se usaba con las herramientas MCP `mcp__github__*` (en local, `gh` si está instalado, o la web en Chrome). Por ejemplo, `actions_list` para ver las ejecuciones del workflow.

---

## 3. Historia del trabajo (resumen cronológico)

Commits del 29-09-2026 (los últimos; detalle en el README y en la sección 4):

```
326293e The real Gulf of Mexico under the flight; landing smoke, hot-staging vents and vacuum halo matched to photographs
1b0baf3 Pad 2 tower at its traced angle to the trench; deluge and propellant farm from OSM footprints; V3 simultaneous ignition; measured stainless tint
1e84d68 Launch sequence on SpaceX's flight 14 timeline; tower height from the FAA; vacuum plumes
e1ed5f0 Fire that reads as fire; smoke grows from its source; walk picks through the fence; tank farm labels; quick guide
9ae2f44 Heat shield tiles no longer overlap; far mosaic reads as hexagons
046ee5e Launch camera rides with the rocket; hot staging clipped at the booster dome and ship pivots on itself; …
```

Anteriores:

```
6ec11a5 Document the Falcon 9 stations against the FH demo photograph; README: external audit outcomes
b2f5ad7 Roadster to Tesla's own figures: 1.851 m across the mirrors, 0.871/0.724 m overhangs, 1.456/1.485 m tracks, 1.127 m high; body width reconstructed; per-figure tolerances in the check; CI gates grok/** with one concurrency queue per branch
d568c60 Heat shield tiles charcoal with pale chamfered edges, as in the Ship 39 close-ups
d83b172 Pad 2 tower in bare light-grey steel with dark arms, clad tower base with its rear housing; Block 3 booster with its 33 Raptors hanging in the open below the thrust ring
23658d6 Liftoff plume yellow-white rather than salmon; flaps preset frames the flap in profile
8006275 Pad 2 pin centring (one sled and a telescopic pusher per arm); Raptor Vacuum carries the sea-level pack
518498a Pad 2 chopsticks about 26 m (NSF)
215b1ce Starman suit greys; Starlink figures re-read at source
2edc3b3 Falcon fairing access door (610 mm, User's Guide 2025)
c5b86c6 Close the tank-farm domes; carbon louvre panel on the Roadster bonnet
66d0242 Starship V3 and Pad 2 checked against official data and photographs
```

### Rondas anteriores (ya hechas y documentadas en el README)
- **Pad 2 rehecho con referencias**: se quitaron mástiles y farolas sin sentido.
- **Estabilidad del render**: parpadeos y huecos entre losetas.
- **Vehículos y montaje**: HUD, Falcon 1 muy mejorado, Falcons limpios (sin hollín) y apoyados de verdad sobre mesas con pinzas, carretera realista (MUTCD), Starman mucho mejor.
- **Auditoría de Grok (A1–A16)**: pines del propulsor alineados con los brazos, pines de la nave, etc.
- **Rondas R3/R4**: entorno (terreno, costa, dunas, lagunas, cielo, mar), cada vehículo y el lanzamiento sin tirones.
- **Correcciones pedidas por el usuario**: hierba junto a la costa, captura sin que los brazos atraviesen el propulsor, más calidad del suelo, Starship primero en el HUD, sol más bajo por defecto, losa de la explanada solapando la carretera.
- **Ronda 5 (lanzamiento, sonido y entorno)**:
  - presupuesto de partículas de la nube, atlas 2×2 de bocanadas, fuego por la zanja, `Glow`;
  - penacho con mezcla premultiplicada;
  - sonido: crepitar por choques en N, fluctuación, reflexión en el suelo (filtro en peine), golpes de encendido 3 → 13 → 33;
  - oclusión ambiental desactivada durante el lanzamiento.
- **«Starship V3 contra las fotos»**:
  - alturas oficiales: propulsor 236 ft = 71,93 m, nave 171 ft = 52,12 m, total 124,05 m; Raptor 3 de 1,3 × 2,9 m;
  - propulsor: etapa caliente integrada tipo N1 (20 pares de puntales), cúpula delantera blindada, 3 rejillas negras con celdas en escama, acero casi espejo con líneas punteadas de largueros, anillos de tuberías y cajas de conexiones en la popa, toberas Raptor 3 grafito mate, giro 108°–108°–144° de los 3 centrales, conducto exterior hasta media altura;
  - nave: conos de acoplamiento;
  - Pad 2: mesa con contrafuertes, plataforma a 5 m y cubierta a 18 m;
  - otros vehículos: tanques de la granja, puerta de 610 mm de la cofia, grises del traje de Starman, lamas de carbono del Roadster, Starlink (2 × 52,5 m² de paneles).

### Esta última sesión (en orden)
1. **Brazos del Pad 2**: miden ≈26 m (NSF: 10 m menos que los ≈36 m del Pad 1). La verificación lo comprueba (`EXPECTED_PAD.armLen`).
2. **Centrado de pines** (NSF): un carro por brazo y un empujador telescópico en la punta. Tamaños reconstruidos.
3. **Raptor Vacuum**: ahora lleva el mismo paquete de turbobombas que el Raptor de nivel del mar (antes, un tambor pequeño). Se añadió `profileRadius()` (interpolado) para los aros de la tobera, que antes quedaban escondidos. Las tuberías de la fila de motores solo van en el Merlin.
4. **Penacho**: el núcleo pasa de salmón a blanco-amarillo; la ganancia depende de la presión (`3.4 + 3.6·p`). Encuadre «Flaps and nose» cambiado.
5. **Torre del Pad 2**, según fotos NSF del pad terminado (mayo 2026):
   - acero **gris claro** (`M.towerClad`, textura `makeTowerClad`), con brazos, carro y QD **grafito oscuro** (`M.towerSteel`);
   - **base de la torre**: bloque revestido de ≈9 m con volumen trasero de 6,5 m, dos plantas de huecos y pasarela, medido en la foto (aproximado);
   - cabrestante detrás de la base; el cable entra por encima de ella.
6. **Popa del Super Heavy V3**: los **33 Raptor cuelgan al aire** bajo el anillo negro de empuje (antes, escondidos en un faldón de 3 m).
   - `BOOSTER_AFT = 3.15` (en `starship.js`): el anillo, la placa de empuje y las tuberías empiezan a esa altura sobre la salida de las toberas.
   - **Todo el conjunto baja 3,15 m en la mesa**: `mount: PAD.deckTop - BOOSTER_AFT` en `main.js`; las pinzas agarran el borde del anillo.
   - `qdY = 96 − BOOSTER_AFT`; los emisores de vapor apegados a la mesa se desplazan igual; `towerClear` se recalcula (`CLIMB = 144.5 − (13 − BOOSTER_AFT)`).
   - Sin separadores de bahía; `hardware-check.mjs` lo comprueba ahora.
7. **Losetas del escudo** (primer plano NSF del Ship 39):
   - color carbón (base `0x37383d`, `envMapIntensity` 0,5);
   - **bisel claro** de ≈7 mm con colores por vértice (`hexPrism(..., 0.045, 3.0)`, `M.tile.vertexColors`);
   - se descartó aclarar la capa inferior, porque desde ~30 m aclaraba todo el escudo;
   - `tools/lod-pop.mjs`: |Δ| 20 frente a 24 antes.
   - Ojo: `_frames.mjs` no actualiza el nivel de detalle. Para ver las losetas reales de cerca hay que llamar `v.lod.pin('starship-tps', true)`.
8. **Auditoría externa de ChatGPT**, contrastada:
   - **Roadster: error real, corregido.** El manual de servicio y el del propietario de Tesla dan 3946 mm de largo, **1851 mm de ancho con espejos**, 1127 mm de alto, 2351 mm de batalla, **voladizos 871/724 mm**, vías 1456/1485 mm y 130 mm de altura libre.
     - El modelo usaba 1852 mm como anchura sin espejos (mala lectura de fuentes secundarias) y tenía los voladizos simétricos.
     - Corrección en `reshapeToPublished()` (`roadster.js`), un post-proceso de vértices con normales corregidas:
       - estrecha la carrocería a **≈1,75 m (reconstruido)**;
       - deja los espejos con la cara exterior en 1851/2, sin tener en cuenta el giro hacia dentro de la carcasa;
       - estira los voladizos solo más allá de los pasos de rueda, con mezcla cuadrática;
       - escala el parabrisas hasta 1,127 m;
       - desplaza a Starman con su asiento;
       - recentra el coche (−7,35 cm).
     - Ejes resultantes: +1,102 y −1,249 m.
   - **Tolerancias por figura** (`tols` en `EXPECTED`) y la nueva medida «anchura total con espejos» en `verify.js`.
   - **Falcon 1**: README corregido a 21,98 m / Ø1,681 m (plano acotado de la guía 2008).
   - **CI**: `grok/**` añadido; concurrencia por rama.
   - **Falcon 9**: se mantienen las estaciones (41,2 m de primera etapa incluyendo la interetapa). Verificado por fotogrametría en la foto del FH de la demo: rejillas a ≈39,5 m. Documentado en `falcon.js`. La cofia sigue en 13,2 × 5,2 m (guía 2025).
   - **Dragon: PENDIENTE.** Número de ventanas: el modelo tiene 4 en el costado más la de la escotilla. La NASA actual dice 3 y documentos antiguos 4. No se encontró una foto clara. No se ha tocado nada.

---

## 4. Estado actual y pendientes

- **Ronda del 28 de septiembre de 2026** (detalle en el README, sección *Auditoría y mejoras del 28 de septiembre de 2026*):
  - la **nave tras la separación** se integra como un cohete (`SHIP_ASSUMED` y `buildProfile` en `launch.js`): empuje y propelente publicados, masa en seco e Isp supuestos (≈), guiado de tangente lineal resuelto por Newton para nivelarse a ≈150 km. `pitchAt` es ahora la **actitud** (empuje) y `flightPathAt` la dirección de la velocidad;
  - **contexto WebGL**: `env.rebuildProbe()` al recuperarlo (`onContextRestored` en `main.js`);
  - **audio** suspendido con la pestaña oculta (`sound.js`);
  - **cámara**: `rig.groundAt` (terreno + pad, analítico) como suelo del vuelo libre; **modo paseo** (`V`, `rig.mode === 'walk'`, ojos a 1,7 m, obstáculos en `rig.obstacles`, doble clic para caminar a un punto);
  - **vista general** que se adapta al formato (`overviewFor(aspect)`), y se reencuadra al girar el móvil;
  - **panel de misión**: pausa (K / espacio), ×¼, reinicio, clic/arrastre en el perfil para saltar, ←/→ entre hitos, plegable (empieza plegado con < 600 px de alto);
  - **visita guiada** con texto y fuente por parada (`TOUR` en `main.js`, comprobada por `provenance-check`);
  - **humo y vapor**: contacto suave con el suelo (`groundUnder` en los sombreadores de `plume.js`, uniforme `uPad`), bordes suaves, chorros turbulentos (`turbulence` en `EngineJets`);
  - **herramientas**: `?perf` (medidor de fps), ESLint (`eslint.config.js`, primer paso de `npm run check`), CI en cuatro trabajos paralelos (`check:static`, `check:scene`, `check:ux`, `check:lod`), historial del README movido a `docs/historial.md`.
- **Segunda ronda del 28-09** (detalle en el README, *Lanzamiento, segunda ronda del 28 de septiembre de 2026*):
  - **cámara montada en el cohete** durante la secuencia (`followCamera` en `launch.js`; `state.follow` = 'booster' | 'ship'; tecla C / botón *Camera*; 'none' solo como control negativo de la prueba);
  - **separación en caliente**: el penacho y los chorros de la nave se cortan en la cúpula del propulsor mientras está en su eje (`maxLength` en `Plume.setThrottle` y `EngineJets.setState`); la nave gira sobre su centro (`SHIP_PIVOT`);
  - **llamas**: ruido volumétrico en `PLUME_FRAG` (uniformes `uLen`, `uRad`, `uP`, `uRag`), núcleo corto y envolvente tenue en el vacío;
  - **estela de condensación** del ascenso (`ascentTrail`, Vapor con trayectoria);
  - **V3 en el regreso**: 33 → 13 motores en el *boostback* (`BOOSTBACK_33` ≈10 s) y 13 → 5 → 3 en el aterrizaje (`BURN_FIVE` ≈3 s antes de `BURN_THREE`), con el empuje resuelto de nuevo; límite de `cloud-check` a 12 g;
  - **solo ordenador**: fuera la barra inferior de móvil y el CSS de teléfono; aviso en la carga y en pantallas pequeñas; `ux-check` solo en tamaños de escritorio (DPR 1);
  - **paseo**: 60° de campo de visión, ritmo con la rueda (1,4–25 m/s, empieza en 3), `rig.walls` (valla y zanja), doble clic = viaje (`rig.travelTo`, ruta por la puerta del vial en `walkRoute`).
- **Tercera ronda (28-29 de septiembre)** (detalle en el README, *Tercera ronda*):
  - **losetas**: filas impares de arcos parciales desplazadas media columna (`tileSurfaceOfRevolution`), 13 267 losetas; mosaico lejano de 16 × 16 losetas con juntas claras (`makeTpsPattern`), `bias` 1.5; `M.tpsShell` sigue en 2.3 (lod-pop ±3,1);
  - **paseo**: el doble clic ignora las mallas `site-fence*` y aparta el destino 1 m de `rig.walls`; prueba con doble clic real y control negativo en `ux-check`;
  - **fuego**: clase `Fire` en `plume.js` (partículas deterministas por tiempo de misión, uniformes por fase con `set({...})`); `Plume` lleva la suya (`fireCount`), y `launch.js` añade `trenchFire` (ahora `Fire`), `deckFire` (chorro contra la mesa, ≈) y `baseGlare` (Glow bajo los motores). Recuentos por calidad (`fireScale`);
  - **humo**: bocanadas de la zanja nacen con 11 m y se ven en 0,8 s (`fadeIn` por edad en `GroundCloud.update`); humo del aterrizaje tenue y pardo (opacidad 0,05, 70 bocanadas de 24 m por emisor, deriva con el viento), contrastado con la foto del vuelo 5 en aproximación final;
  - **granja de tanques**: etiquetas desde `buildField` y `buildPadInfrastructure` (`userData.annotations`), encuadre `farm` en `specs.js`;
  - **guía rápida**: el diálogo `#help` es ahora una guía (primeros pasos + tarjetas por modo, la del modo en uso marcada por CSS con `#hud.walk/.fly` y `body.is-flying`); `H`, `?` o el botón *Guide*;
  - **fin de secuencia**: `onFinish(completed)`; solo al completarla aparece un aviso sobre lo que hace la nave después (`notice(text, ms)`, clase `.callout.is-long`).
  - **Propuesta abierta:** un capítulo de **reentrada de la nave** (plasma, actitud con el vientre por delante, maniobra con las aletas, *flip* y encendido de aterrizaje o amerizaje). Necesita cronología publicada de un vuelo concreto antes de empezar.
- **Ronda de fuentes (29-09)** (detalle en el README, *Ronda de fuentes*):
  - `EVENTS` en `launch.js` son los del vuelo 14 (spacex.com): diluvio −17, arranque −3, despegue 0, Max-Q 58, MECO 140, separación 142, boostback 147–187, aterrizaje 396–421 (captura), `shipCutoff` 491, `end` 500. `BURN_THREE = catch − 17`, `FLIP_END = boostbackStart + 1.5`, `RETRO_BLEND` relativo.
  - `PITCH.tau` se resuelve por bisección para `MECO_ALTITUDE` (64 km); `SHIP_ASSUMED.dry` y la ley de guiado se resuelven por Newton (3×3) para apagar a 195 km con vh = 0 y v = `SHIP_STEERING.cutoffSpeed` (arco del vuelo 12). 5 motores en la separación (`FIVE`). Plano final `SHIP_FINALE = catch + 10` (cielo y panel siguen a la nave).
  - Torre: `sections: 12`, `mast: 3.05` (FAA 2022, fuente `faa_pea2022`, grado C con `approx: true`); tipo de fuente `faa` en `SOURCE_LABEL` y en `provenance-check` (grado C).
  - Penachos: colores de núcleo y envoltura interpolados a blanco-azulado con √p (`this.palette` en `Plume`); llama `Fire` ∝ √p.
  - Guiones de capturas (`launch-shots.json`, `sun18-shots.json`) pasados al nuevo reloj, con `launch-ship-cutoff.jpg`. **Galería sin regenerar.**
- **Ronda de realismo (29-09)** (detalle en el README, *Ronda de realismo… planos del Pad 2 y V3*):
  - **torre girada**: `STACK_YAW_DEG = −37.5` (`starship.js`) y `PAD.towerYawDeg` igual; en `pad.js` la torre, brazos y mástil cuelgan de un grupo `tower-frame`, y `towerToPad([x,y,z])` pasa del marco de la torre al de la zanja (lo usan etiquetas, obstáculos del paseo en `main.js` y `check.mjs`). Pines con `pinPhi = 0` (giran con la pila). Vistas `site` y `tower` recalculadas;
  - **deluge** (`DELUGE` en `pad.js`: 11 tanques horizontales, ≈3,45 m) y **parque de propelentes** (`ROW` de 30 tanques horizontales, vaporizadores, subenfriadores) desde huellas de OSM (fuente `osm_starbase`, ≈); volumen del deluge contrastado con `nsf_pad2_deluge`. Conversión OSM → marco de la zanja: C = (−104,35, 29,65), d = (0,836, −0,550), n = (0,550, 0,836), x = −(p·n), z = p·d;
  - **encendido simultáneo** de los 33 (`throttleAt` con `smoothstep(u, 0.05, 0.55)` entre `ignition` y `liftoff`; `boosterLit` = 33 antes del despegue; golpe único en `sound.js`);
  - **acero**: `M.steel*` y `M.booster*` llevan el color `stainless` (lineal 1,041 / 0,995 / 0,932, de physicallybased.info normalizado a luminancia 1).
  - Dominios: overpass-api.de y web.archive.org fallan por el túnel; oeaaa.faa.gov (Akamai) deniega, no eludir; matweb/engineeringtoolbox necesitan el prefijo `www.` en la lista.
- **Segunda ronda de realismo (29-09):**
  - **Tierra real** en `FlightEarth` (`plume.js`): `data/gulf.js` (anillos de Natural Earth en centésimas de grado, relleno par-impar, caja lon −116…−60, lat 4…43; `LAUNCH_SITE` con lat/lon del Pad 2 y azimut 100,8°) y `src/assets/earth/gulf-bmng.jpg` (Blue Marble NG, 2048 × 1426). La máscara se dibuja en un lienzo y la imagen se carga la primera vez que el globo se hace visible (`loadMap`); hasta entonces, y fuera de la caja, queda la superficie genérica. `uGeo` (mat3) lleva la normal local a coordenadas terrestres: marco del pad girado d/R alrededor de Up × dirección (`setOrigin(ex.lay.x, ex.lay.z)` en `launch.js`). Verificado contra la fórmula del círculo máximo (1 000 km a 100,8° → 23,991° N, 87,481° O). Pages copia `src`, así que `src/assets` se publica.
  - Humo del aterrizaje, respiraderos de la separación (`uWarm`/`uTail` propios), borde del resplandor `0xff9a44` y halo de vacío azul (`palette.vac`).
  - `lod-pop.mjs`: los encuadres de losetas giran con `model.rotation.y` del expositor.
- **Red y navegador:** el entorno usa ahora una lista *Custom* de dominios (spacex.com, Wikipedia, Commons, upload.wikimedia.org, NSF, nasa.gov, faa.gov, github.io). Para que Chromium de Playwright confíe en el proxy hay que registrar su CA en el almacén NSS: `certutil -A -d sql:/root/.pki/nssdb -n ccr-agent-proxy -t "C,," -i /root/.ccr/agent-proxy-ca.crt` (`certutil` viene de `libnss3-tools`). Wikimedia devuelve 429 a agentes genéricos: usar miniaturas estándar (`/thumb/…/1280px-…`) y un agente descriptivo sin datos personales («VehicleCenterResearch/1.0 (educational 3D model)»). Los PDF de la FAA se leen con `pdftotext` (`poppler-utils`).
- **Búsqueda web (histórico):** en algunas sesiones en la nube solo funcionaban los resúmenes de `WebSearch`; lo leído así se cita como tal. En local, con Chrome, lee la fuente directamente.
- **Galería:** sigue sin regenerar desde `b1f09d3` y ahora está más desfasada (fila de transporte del panel, botón *Walk*, trayectoria de la nave tras T+2:40, fuego nuevo, botón *Guide*, encuadre *Tank farm*). **Regenerarla necesita aprobación del usuario.**
- **Red (histórico, contenedor en la nube):** la red estaba limitada a una lista de dominios; en local no hay esa limitación.
- **No hacer:** el regulador de calidad adaptativo (descartado por el usuario). No reintroducir stencil en el render target MSAA (hundió la escena a ~10 fps en GPU real). Por la misma razón, **no añadir una textura de profundidad** a ese render target para «partículas suaves»: obligaría a resolver una profundidad multimuestreada en cada fotograma, el mismo tipo de coste.
- **Pendientes abiertos, todos a la espera de evidencia:**
  - **altura de la torre**: resuelta con la FAA (≈480 ft + 10 ft, 2022); el registro OE/AAA concreto de la torre del Pad 2 sigue sin localizar (daría la cifra construida, no la planificada);
  - **giro de la pila**: ahora −37,5° con la torre, desde huellas de OSM (≈, no levantamiento);
  - **17 s finales con 3 motores** (≈T+6:44 en el reloj V3): trasladados de una lectura del vuelo 5 sin contrastar;
  - **nave tras la separación**: contrastar velocidad y altitud con la telemetría de las retransmisiones y afinar masa en seco, Isp y altitud de nivelación (hoy supuestos);
  - **pinzas del Falcon 1 en Omelek** (fotos de Commons revisadas: la base no se ve), **ventanas del Dragon** (tercera ventana: sin fuente que la sitúe); el penacho del boostback a gran altura quedó resuelto;
  - propuestas estructurales aún sin abordar: modularizar los archivos grandes (`roadster.js` ≈3 700 líneas, `launch.js`, `main.js`), `@ts-check`, pruebas en WebKit y Firefox, variante exacta de Starlink. (`prefers-reduced-motion` ya está implementado: CSS, barridos de cámara y vibración del lanzamiento.)

## 5. Datos y convenciones técnicas útiles

- **Marco de Starship**: el origen del conjunto es el plano de salida de las toberas del propulsor.
  - `ex.lay.mount = PAD.deckTop − BOOSTER_AFT` (18 − 3,15).
  - `PAD`: `padY 5`, `bermY 2.5`, `deckTop 18`, `towerX −30`, `towerHalf 6.1`, `section 12.2` × 12 (146,4 m de celosía ≈ 480 ft), `mast 3.05` (pararrayos de 10 ft; total ≈149,5 m, FAA 2022), `armLen 26`, `armY 132` (≈), `qdY 96 − BOOSTER_AFT`, `trenchFloorY 0.8`.
  - Guiñada del conjunto: `STACK_YAW_DEG = −37,5` desde el 29-09 (la torre a ≈52,5° de la zanja, huellas de OSM); antes era 0, inferida de la foto del ensayo del 11 de mayo de 2026. La panza (losetas) mira a +z local de la pila.
- **Presets de cámara**: por defecto en el marco del vehículo (giran con él). Con `frame: 'site'` van en el marco del sitio. Se definen en `specs.js`.
- **Integridad de mallas** (`verify.js`): comprueba que la escala de las UV cuadre con el `tileSize` del mapa. Una geometría construida lejos del origen da falsos positivos, así que conviene construirla centrada y posicionarla.
- **Materiales**: `M.steel`, `M.steelSkirt`, `M.aftBlack`, `M.bellRaptor3`, `M.metalTile`, `M.domePlate`, `M.gridFin`, `M.tile`, `M.tileUnder` (oscuro), `M.tpsShell`, `M.towerClad`, `M.towerSteel`, `M.concrete`, `M.darkMetal`, `M.blackMatte`, etc.
- **Tiempos de la secuencia** (`launch.js`, `EVENTS`):
  - vuelo 14 (spacex.com): diluvio −17, arranque −3, despegue 0, Max-Q 58, MECO 140, separación 142;
  - boostback 147–187, encendido de aterrizaje 396, captura 421 (apagado del aterrizaje), apagado de la nave 491, fin 500;
  - derivados del modelo: paso de la torre ≈6,8 s, supersónico ≈47, apogeo del propulsor ≈230 (≈106 km), transónico ≈391; 5 motores `BURN_FIVE` 401, 3 motores `BURN_THREE` 404 (aproximado).
- **Fuentes clave ya usadas**:
  - spacex.com (Starship, V3), Falcon User's Guide 2025, Falcon 1 User's Guide 2008;
  - Tesla Roadster Service Manual: https://service.tesla.com/docs/Public/Roadster/ServiceManual/en-us/GUID-4E037ADB-D0F4-48A0-9261-1083193D4C1B.html
  - NSF: «Starbase Pad 2: Design Advancements» (ago. 2025), «Super Heavy Block 3» (may. 2026), Ship 39 (feb. 2026);
  - Wikipedia, con precaución.

---

## Anexo: herramientas locales (no están en el repo; recréalas)

**Añadidas el 04-10 (tercera sesión):** son scripts pequeños que se rehacen fácilmente.
- `_uxtail.mjs`: una copia del bloque del F-16 de `ux-check.mjs` con su arranque, para probarlo en ≈3 min. Hay que sincronizarla a mano con `ux-check`.
- `_f16snd.mjs` y `_f16wav.mjs`: extraen el WORKLET de `f16Sound.js` como hace `sound-check.mjs`, miden niveles y escriben WAV (16 bit, 48 kHz) en el scratchpad.
- `_wl.mjs`, `_xw.mjs`, `_xw2.mjs`, `_xw3.mjs` y `_gp.mjs`: vuelan `createF16Flight` y `createF16Assist` sin navegador, con viento constante o el del sitio, y escriben por consola el rumbo, la deriva y el pedal.
- **Lo que necesitan:** importar módulos de `src` con el hook de `registerHooks` de `f16-check.mjs`, que resuelve `three` y `three/addons/`.

Están excluidas en `.git/info/exclude` (`tools/_frames.mjs`, `tools/_probe.mjs`, `tools/_web.mjs`…). En un contenedor nuevo no existen: créalas con este contenido y añádelas a `.git/info/exclude`.

### `tools/_frames.mjs`: renderiza fotogramas directamente del compositor
Uso: `node tools/_frames.mjs <frames.js> <outdir> [--port 8814] [--w 1280 --h 720]`.

`frames.js` es una expresión JS que devuelve un array `[{ name, t?, setup? }]`, donde `setup` es el cuerpo de JS que se ejecuta tras el seek, con `v` y `THREE` en el ámbito. Ejemplo:

```js
[{ name: 'a', t: 8 }, { name: 'b', setup: "v.jump('starship','engines'); await new Promise(r=>setTimeout(r,3500));" }]
```

Los fotogramas sin `t` heredan el estado del anterior. Usa `t: -40` y `v.launch.reset(false)` para tener el conjunto en la mesa.
```js
// Local, not committed: boots once and renders a list of frames straight from the composer.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(argOf('--port') ?? 8814);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const W = Number(argOf('--w') ?? 1280), H = Number(argOf('--h') ?? 720);
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
const out = args[1];
await mkdir(out, { recursive: true });
try {
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/${argOf('--query') ?? ''}`, argOf('--quality') ?? 'high');
  await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; const v = window.__vc; v.setToggle('labels', false); v.setToggle('ruler', false); v.hud?.hideCoach?.(); });
  const list = await page.evaluate(`(async () => { const v = window.__vc; const THREE = await import('three'); return ${await readFile(args[0], 'utf8')}; })()`);
  for (const f of list) {
    const t0 = Date.now();
    const url = await page.evaluate(`(async () => {
      const v = window.__vc; const THREE = await import('three');
      const f = ${JSON.stringify(f)};
      if (f.t !== undefined) { v.launch.setSpeed(0); v.launch.seek(f.t); }
      ${f.setup ?? ''}
      v.camera.updateMatrixWorld();
      v.composer.render(); v.composer.render();
      return v.renderer.domElement.toDataURL('image/jpeg', 0.88);
    })()`);
    await writeFile(`${out}/${f.name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(f.name, `${Date.now() - t0} ms`);
  }
} finally { await browser.close(); server.close(); }
```

### `tools/_probe.mjs`: evalúa un script en la página y devuelve el resultado en JSON
Uso: `node tools/_probe.mjs <script.js> [--port 8813]`. En el script ya están `v` y `THREE`; **no vuelvas a declarar `const THREE`**.
```js
// Local, not committed: boots the page at high quality and evaluates a JS file against it.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { staticHandler } from './static.mjs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootAtQuality } from './census.mjs';

const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(argOf('--port') ?? 8813);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = createServer(staticHandler(ROOT, TYPES));
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const W = Number(argOf('--w') ?? 1600), H = Number(argOf('--h') ?? 900);
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
page.on('pageerror', e => console.error('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('CONSOLE', m.text()); });
try {
  await bootAtQuality(page, `http://127.0.0.1:${PORT}/${argOf('--query') ?? ''}`, argOf('--quality') ?? 'high');
  const body = await readFile(args[0], 'utf8');
  const out = await page.evaluate(`(async () => { const v = window.__vc; const THREE = await import('three'); ${body} })()`);
  if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  const shot = argOf('--shot');
  if (shot) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    await page.screenshot({ path: shot, timeout: 300000 });
  }
} finally { await browser.close(); server.close(); }
```

### `tools/_web.mjs`: navegador real para investigar
Uso: `node tools/_web.mjs <url> <prefijo-salida> [--wait 6000] [--full]`. Escribe `.png`, `.txt`, `.imgs` y `.links`. Requiere la CA del proxy en NSS (ver sección 2).
```js
// Local, not committed: a real browser for research.
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
const argOf = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const [url, out] = args;
const browser = await chromium.launch({ args: ['--no-sandbox'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const ctx = await browser.newContext({
  viewport: { width: Number(argOf('--w') ?? 1440), height: Number(argOf('--h') ?? 900) },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  locale: 'en-US', ignoreHTTPSErrors: false,
});
const page = await ctx.newPage();
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(Number(argOf('--wait') ?? 5000));
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 150)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}.png`, fullPage: args.includes('--full') });
  const text = await page.evaluate(() => document.body.innerText);
  await writeFile(`${out}.txt`, text);
  const imgs = await page.evaluate(() => [...document.images].map(i => `${i.naturalWidth}x${i.naturalHeight} ${i.currentSrc || i.src} | ${(i.alt || '').slice(0, 80)}`));
  await writeFile(`${out}.imgs`, imgs.join('\n'));
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => `${a.href} | ${(a.innerText || a.title || '').trim().slice(0, 60)}`));
  await writeFile(`${out}.links`, links.join('\n'));
  console.log('ok', (await page.title()), text.length, 'chars');
} catch (e) { console.log('ERR', e.message); }
await browser.close();
```

### `sheet.py` (en el scratchpad): hoja de contactos de una carpeta de JPG
Uso: `python3 sheet.py <carpeta> <salida.jpg> [columnas]`.
```python
import sys, glob
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3
fs = sorted(glob.glob(d + '/*.jpg'))
fs = [f for f in fs if not f.endswith('sheet.jpg')]
w, h = 520, 293
W = Image.new('RGB', (w * cols, h * ((len(fs) + cols - 1) // cols)))
for i, f in enumerate(fs):
    im = Image.open(f).resize((w, h))
    ImageDraw.Draw(im).text((6, 4), f.split('/')[-1], fill=(255, 0, 0))
    W.paste(im, ((i % cols) * w, (i // cols) * h))
W.save(out, quality=85)
```

**Encuadres de todos los expositores**: la lista de presets está en `specs.js`. Para auditar, genero un `frames.js` con `v.jump(id, preset)` para cada uno y reviso la hoja de contactos.

### `mk.py` (en el scratchpad): encuadres en el marco del vehículo
Uso: `[HIDE='^h2r-(tank|cowl)'] python3 mk.py salida.js <expositor> nombre px py pz tx ty tz ...` y luego `node tools/_frames.mjs salida.js <carpeta>`. Antepone un encuadre `_warm` (el primero sale a menudo vacío).
```python
# usage: mk.py out.js ex name px py pz tx ty tz [fov] ...  (local frame of the exhibit's model)
import sys, json, os
HIDE = os.environ.get('HIDE', '')
out, ex = sys.argv[1], sys.argv[2]; a = sys.argv[3:]; L = []
while a:
    n, *v = a[:7]; a = a[7:]
    p, t = v[:3], v[3:6]
    L.append({'name': n, 'setup': f"""v.jump('{ex}','overview'); await new Promise(r=>setTimeout(r,4500)); v.lod.forceDetailed?.();
const m=v.exhibits['{ex}'].model; m.updateMatrixWorld(true); {('m.traverse(o=>{ if(o.isMesh && /'+HIDE+'/.test(o.name)) o.visible=false; });') if HIDE else ''}
const P=m.localToWorld(new THREE.Vector3({p[0]},{p[1]},{p[2]})), T=m.localToWorld(new THREE.Vector3({t[0]},{t[1]},{t[2]}));
v.rig.jumpTo(P,T); await new Promise(r=>setTimeout(r,1500)); v.camera.position.copy(P); v.camera.lookAt(T); v.camera.updateProjectionMatrix();"""})
json.dump([dict(L[0], name='_warm')] + L, open(out, 'w'))
```

### `ortho.py` (en el scratchpad): vista lateral derecha casi ortográfica a 1,644 mm/px
Uso: `python3 ortho.py o.js orR 0.0 0.55 [regex]`; añade tú un `_warm` delante como en `mk.py`. Plano cercano a D−1,6 m para no ver los otros expositores.
```python
# usage: ortho.py out.js name cx cy [hide-regex]  -> right-side near-orthographic frame, 1.644 mm/px at 1280x720
import sys, json, math
out, name, cx, cy = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]); hide = sys.argv[5] if len(sys.argv) > 5 else ''
D = 40.0; fov = 2 * math.degrees(math.atan(360 * 0.001644 / D))
setup = f"""v.jump('h2r','overview'); await new Promise(r=>setTimeout(r,4500)); v.lod.forceDetailed?.();
const m=v.exhibits['h2r'].model; m.updateMatrixWorld(true);
{"m.traverse(o=>{ if(o.isMesh && /"+hide+"/.test(o.name)) o.visible=false; });" if hide else ""}
const P=m.localToWorld(new THREE.Vector3({cx},{cy},{D})), T=m.localToWorld(new THREE.Vector3({cx},{cy},0));
v.rig.jumpTo(P,T); await new Promise(r=>setTimeout(r,1500)); v.camera.position.copy(P); v.camera.lookAt(T); v.camera.fov={fov}; v.camera.far=200; v.camera.near={D-1.6}; v.camera.updateProjectionMatrix();"""
json.dump([{'name': name, 'setup': setup}], open(out, 'w'))
```

### `blend.py` (en el scratchpad): foto derecha alineada sobre el render por los ejes
Uso: `python3 blend.py en/orR.jpg salida.jpg 0.5 [x0 y0 x1 y1 zoom]` (deja también `_photo.jpg`, la foto sola en el mismo encuadre).
```python
# usage: blend.py render.jpg out.jpg [alpha] [x0 y0 x1 y1 zoom]  (render's axles R(333,500) F(1215,515.1) -> photo's)
import sys
from PIL import Image
S = '<scratchpad>'
r = Image.open(sys.argv[1]).convert('RGB'); a = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
p = Image.open(S + '/ref/h/Kawasaki_Ninja_H2R_right.JPG').convert('RGB')
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0)          # photo = R1 + k (render - R0)
c0 = R1 - k * R0
w = p.transform(r.size, Image.AFFINE, (k.real, -k.imag, c0.real, k.imag, k.real, c0.imag), resample=Image.BICUBIC)
out = Image.blend(r, w, a)
if len(sys.argv) > 4:
    x0, y0, x1, y1, z = map(int, sys.argv[4:9]); out = out.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z))
    w.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z)).save(sys.argv[2].replace('.jpg', '_photo.jpg'))
out.save(sys.argv[2])
```

### `seg.py` (en el scratchpad): la foto derecha proyectada al plano lateral del modelo (1 px = 1 mm)
Uso: `python3 seg.py` → `en/model_mm.png` (x de −0,9 a 0,9 m, y de 0 a 1,2 m).
```python
# The right-side photograph warped into model space: 1 px = 1 mm, x from -0.9 to 0.9, y from 0 to 1.2.
import numpy as np, cv2
from PIL import Image
S = '<scratchpad>'
p = Image.open(S + '/ref/h/Kawasaki_Ninja_H2R_right.JPG').convert('RGB')
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0); c0 = R1 - k * R0
s = 0.0016441
# model (x, y) -> render (u, v) -> photo
def photo(x, y):
    r = complex(333 + (x + 0.725) / s, 500 - (y - 0.32) / s); q = c0 + k * r; return q.real, q.imag
# output pixel (i, j): x = -0.9 + i/1000, y = 1.2 - j/1000. Affine coefficients photo = A*(i,j)+b
x0, y0 = photo(-0.9, 1.2); x1, y1 = photo(-0.9 + 0.001, 1.2); x2, y2 = photo(-0.9, 1.2 - 0.001)
coef = (x1 - x0, x2 - x0, x0, y1 - y0, y2 - y0, y0)
w = p.transform((1800, 1200), Image.AFFINE, coef, resample=Image.BICUBIC)
w.save(S + '/en/model_mm.png')
print('coef', coef)
```

### `mgrid.py` (en el scratchpad): rejilla en mm del modelo sobre `model_mm.png`
Uso: `python3 mgrid.py salida.png xmin xmax ymin ymax paso_mm [escala]` (etiquetas en mm del modelo).
```python
# usage: mgrid.py out.png xmin xmax ymin ymax step_mm [scale]   (labels in model mm)
import sys
from PIL import Image, ImageDraw
S = '<scratchpad>'
im = Image.open(S + '/en/model_mm.png'); out = sys.argv[1]; xa, xb, ya, yb, st = map(int, sys.argv[2:7]); sc = float(sys.argv[7]) if len(sys.argv) > 7 else 1
c = im.crop((xa + 900, 1200 - yb, xb + 900, 1200 - ya)); c = c.resize((int(c.size[0] * sc), int(c.size[1] * sc)), Image.LANCZOS); d = ImageDraw.Draw(c)
for x in range((xa // st + 1) * st, xb, st):
    X = (x - xa) * sc; d.line((X, 0, X, c.size[1]), fill=(255, 0, 0) if x % (st * 5) == 0 else (255, 140, 140)); d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range((ya // st + 1) * st, yb, st):
    Y = (yb - y) * sc; d.line((0, Y, c.size[0], Y), fill=(255, 0, 0) if y % (st * 5) == 0 else (255, 140, 140)); d.text((2, Y + 2), str(y), fill=(255, 255, 0))
c.save(out)
```

### `p2m.py` (en el scratchpad): píxel de la foto derecha → mm del modelo
Uso: importar `p2m(u, v)` o `crop(cx, cy, ox, oy, zoom)` para recortes ampliados.
```python
# right.JPG pixel -> model mm (side plane)
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0); c0 = R1 - k * R0; s = 0.0016441
def p2m(u, v):
    r = (complex(u, v) - c0) / k
    return round(((r.real - 333) * s - 0.725) * 1000, 1), round((0.32 - (r.imag - 500) * s) * 1000, 1)
def crop(cx, cy, ox=360, oy=380, z=4): return p2m(ox + cx / z, oy + cy / z)
if __name__ == '__main__':
    pts = {'node': (680, 290), 'fbolt': (600, 290), 'x': (420, 300), 'up': (440, 210), 'peg': (300, 400), 'pegpiv': (330, 390), 'low': (510, 450),
           'hp_tl': (100, 40), 'hp_tr': (330, 60), 'hp_r': (480, 190), 'hp_br': (470, 250), 'hp_b': (200, 230), 'hp_l': (100, 130), 'slot0': (220, 95), 'slot1': (360, 140),
           'ped0': (480, 440), 'pedtip': (650, 575), 'node2': (590, 480)}
    for n, (a, b) in pts.items(): print(n, crop(a, b))
```

### `vol.js` (en el scratchpad): mallas con volumen con signo negativo (del revés)
Uso: `node tools/_probe.mjs vol.js`. Los huecos interiores (taladro del eje, interior del silenciador) salen negativos a propósito.
```js
const { buildH2r } = await import('/src/vehicles/h2r.js');
const root = buildH2r({}), out = [];
root.updateMatrixWorld(true);
root.traverse(o => { if (!o.isMesh) return; const mats = [].concat(o.material); if (mats.every(m => m.side === THREE.DoubleSide)) return;
  const g = o.geometry, p = g.attributes.position, idx = g.index, N = idx ? idx.count : p.count; let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(new THREE.Vector3()), sz = g.boundingBox.getSize(new THREE.Vector3());
  for (let t = 0; t < N; t += 3) { a.fromBufferAttribute(p, idx ? idx.getX(t) : t).sub(ctr); b.fromBufferAttribute(p, idx ? idx.getX(t+1) : t+1).sub(ctr); c.fromBufferAttribute(p, idx ? idx.getX(t+2) : t+2).sub(ctr); v += a.dot(b.cross(c)) / 6; }
  const box = sz.x * sz.y * sz.z;
  if (v < 0) out.push(`${o.name} vol ${(v*1e6).toFixed(1)} cm3 (box ${(box*1e6).toFixed(0)})`);
});
return out.join('\n') || 'none negative';
```

### `empty.js` (en el scratchpad): mallas sin vértices
Uso: `node tools/_probe.mjs empty.js`.
```js
const { buildH2r } = await import('/src/vehicles/h2r.js');
const root = buildH2r({}), out = [];
root.traverse(o => { if (o.isMesh && !(o.geometry.attributes.position?.count > 0)) out.push(o.name + ' ' + Object.keys(o.geometry.attributes).join(',')); });
return out.join('\n') || 'none';
```

---

Cuando hayas leído todo, sigue la sección «Empieza aquí»: comprueba ramas, CI y Pages, y espera a que te diga qué priorizar. Si hace tiempo de la última auditoría (la del 30-09), propón repetirla con la misma lista.
