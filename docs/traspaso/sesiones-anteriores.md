# Traspaso: sesiones anteriores (del 29-09 al 04-10-2026)

Los traspasos de las sesiones del 29-09, 02-10, 03-10 y 04-10 (segunda sesión): qué se hizo, qué quedó pendiente, las órdenes del usuario de cada día, las auditorías de entonces y cómo retomar cada una. Lo vigente está en [TRASPASO.md](../../TRASPASO.md).

Esta parte se movió de `TRASPASO.md` el 17 de octubre de 2026 **sin cambiar su texto** (solo subió un nivel cada título de sección). Los nombres de sección que cita el resto de la documentación siguen siendo los de entonces.

[← Índice](README.md)

## Sesión del 04-10-2026 (segunda): aplicando la pasada decisiva

- **Rama de la sesión:** `claude/gifted-bohr-7bjkq9`. Se empuja a las cinco ramas y a esa.
- **Configuración de Claude Code:** el proyecto ya no lleva `.claude/settings.json` (se eliminó el 08-10-2026): el usuario decide en cada tarea los flujos de trabajo, los subagentes y el nivel de esfuerzo, sin configuración fija.
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
- **Bloques 4 y 5, sin empezar** (el usuario, el 04-10: «no utilices flujo de trabajo multiagente, hazlo tú mismo poco a poco»; orden de aquella tarea, no permanente):
  - 4, sonido: `sonido.json` y `f16.json` (explosiones en tiempo fraccionario, silbido de la H2R, modelo espacial con Doppler, sonido y botón del F-16);
  - 5: auditar primero los modelos de H2R, Porsche y F-16, y el entorno y las físicas, con renders cercanos y evidencia; guardar los diagnósticos en `docs/`; y luego implementar.
- **Revisiones de los agentes guardadas:** `docs/diagnostico-2026-10-04/revisiones/` (bloques 1 y 2; todo lo encontrado está corregido, salvo la moto parada que no rueda hacia atrás en una cuesta).
- **Lecciones de esta sesión:**
  - Una prueba nueva tiene que fallar con el código viejo. Dos pruebas mías pasaban en vacío (el NaN dentro del plano cercano y la moto que no llegaba a patinar). Comprueba siempre que la condición se da.
  - Trabajar un bloque en un `git worktree` aparte (en el scratchpad) permite verificar y hacer commit del anterior sin mezclar.
  - **Cuidado:** un worktree con `node_modules` enlazado y `git add -A` mete el enlace en el commit; al fusionar, sustituyó el `node_modules` real. Añade `node_modules` al índice nunca (bórralo con `git rm --cached`) o enlázalo fuera de `git add -A`.
  - Las revisiones adversariales con 3 agentes encontraron 3 y 18 defectos reales; merecen la pena antes de cada commit grande.

## Estado al 03-10-2026 (léelo primero)

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

## Histórico (02-10-2026: F-16 volable con mandos sencillos; Porsche conducible con PSM y derrape con Espacio; galería regenerada el 02-10; auditoría de ChatGPT del 02-10: P0 corregidos, P1 mayores pendientes)

## Proyecto en curso: F-16A Block 15 volable (desde el 01-10-2026)

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


## Proyecto en curso: Porsche 911 GT3 RS (desde el 02-10-2026)

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

## Conducción del Porsche y vuelo del F-16, revisados (02-10-2026, orden del usuario)

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

## Galería regenerada (02-10-2026, orden del usuario: «Regenera todo y actualiza todo»)

- Se ejecutaron `npm run shots` (`docs/screenshots`), `docs/hud` y `docs/review-sun18`, y el README lista todas las capturas.
- `tools/shot.mjs` admite `play: { mode: 'f16' | 'gt3', steps: [[teclas, s], …], camera }`. Tras el guion congela la simulación (si no, el bucle de la página seguía conduciendo en tiempo real mientras se estabilizaba la interfaz) y la libera en la captura siguiente.
- `tools/hud-shots.json`: el dock de vehículos solo aparece ya en el modo de escena limpia, así que se quitaron los clics a `#dock-vehicles`, la escena limpia se activa con `#clean-btn` y se eliminaron las capturas `*-views` y `*-tools` de tableta y móvil (sus vistas ya no existen). Las de tableta y móvil enseñan paneles solapados: es lo esperado desde que la web es solo para ordenador (28-09), no una regresión.
- Corregido de paso: el cuadro del Porsche se dibujaba encima de la barra de botones; ahora se coloca por encima de ella.
- La regla sigue: no regenerar sin aprobación expresa cada vez.

## Auditoría técnica de ChatGPT (02-10-2026, sobre `8e595b8`; detalle en el README, sección *Auditoría técnica externa del 2 de octubre de 2026*)

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

## Porsche: copia visual del coche real (orden del usuario del 02-10-2026)

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

## Orden del usuario del 02-10-2026 (segunda): todo el F-16 y el Porsche a fondo, físicas del mapa y la Ninja H2R

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

## Al retomar

1. `git fetch --all` y comprueba:
   - que las cinco ramas (`claude/spacex-vehicle-center-3d-48zlkm`, `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo` y `claude/affectionate-euler-o447rh`) apuntan al mismo commit, el último con este TRASPASO;
   - que los últimos workflows de GitHub Actions pasaron;
   - que Pages sirve ese commit (`curl` a un archivo cambiado con `?x=<aleatorio>`).
2. Lee «Auditoría del 30-09» (abajo) y «Lo que NO se terminó», y espera a que el usuario diga qué priorizar.

## Auditoría del 30-09-2026 (hecha; detalle en el README, sección *Auditoría del 30 de septiembre de 2026*)

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

## Qué es y cómo se trabaja (resumen; el detalle está en las secciones 0–5)

- Simulación web en Three.js de un museo de vehículos de SpaceX **a escala 1:1**, con el lanzamiento completo de Starship V3 desde el Pad 2 de Starbase. Repositorio `alvarodesigns34/spacex`, rama por defecto `claude/spacex-vehicle-center-3d-48zlkm`, web en https://alvarodesigns34.github.io/spacex/.
- **Reglas innegociables** (sección 0):
  - háblame siempre en español;
  - sin pull requests: el mismo commit a las **cinco ramas**;
  - comprobación por niveles: **`npm run check:static` con código 0 antes de cada commit**; el `npm run check` completo al cerrar cada bloque o la sesión; CI lo repite en cada push;
  - README en español, actualizado con cada cambio;
  - solo medidas verificables, con las aproximaciones marcadas (≈);
  - logotipos y rótulos del vehículo real permitidos desde el 14-10-2026 (antes prohibidos); sin plataformas extra, sin modo noche, sin plantas ni objetos nuevos en el entorno;
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

## Entorno local (Windows, sesión del 29-09)

- Clon en `C:\Users\preda\claudespacex\spacex`. En Windows **no hay Python**: sirve la web con `npm run serve` (`tools/serve.mjs`, en el repositorio desde el 30-09) → http://127.0.0.1:8080/.
- **Saltos de línea:** `core.autocrlf=false` y el árbol en LF, como en CI. Con CRLF, dos controles negativos de `tools/provenance-check.mjs` fallan porque buscan `\n`. Si ves decenas de archivos «modificados» sin diff, es solo el índice: `git update-index --really-refresh`.
- **Comprobación sin bloquear el trabajo:** `sh /c/Users/preda/claudespacex/sync-check.sh` copia HEAD más los cambios al worktree `C:\Users\preda\claudespacex\spacex-check` (con `node_modules` enlazado como *junction*) y ahí se corre `npm run check` en segundo plano. **Confirma exactamente lo verificado:** antes de hacer commit compara cada archivo con `cmp` contra la copia. En la sesión anterior se me escapó un commit incompleto (`445d522`) por añadir solo parte de lo verificado; lo arregló `6e4b0bd`.
- Para editar con scripts, usa archivos `.cjs` en el scratchpad: los heredoc de Bash con comillas simples y dobles mezcladas fallan.
- La última sesión usó el **navegador integrado** de la app de escritorio para ver la simulación e investigar (Claude in Chrome se desconectaba con esta página pesada). Usa el que tengas; si puedes navegar, lee las fuentes directamente.

## Hecho en la sesión del 29-09-2026 (todo en GitHub)

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

## Lo que NO se terminó

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
