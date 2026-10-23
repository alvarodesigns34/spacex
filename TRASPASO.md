# Traspaso de contexto: SpaceX Vehicle Center 3D

Hola, Claude. Continúas un proyecto que llevo trabajando contigo durante muchas sesiones. Aquí tienes todo lo necesario para seguir exactamente donde lo dejamos, con los mismos criterios y la misma forma de trabajar. Léelo entero antes de hacer nada.

---

## ⭐ Empieza aquí (estado real al 23-10-2026: lee primero «Estado actual (23-10-2026)», después «Estado actual (17-10-2026)», «Estado actual (08-10-2026)», «Sesión del 05-10-2026 (quinta)», «Sesión del 04-10-2026 (cuarta)» y «Cierre de la sesión del 04-10-2026 (tercera)»)

### Estado actual (23-10-2026): léelo primero

1. **Auditoría conjunta de `spacex` y `cybertruck`** (20-10-2026, revisada el 23-10): `docs/auditoria-2026-10-20-spacex-cybertruck.md`, con el mismo texto en el repositorio `cybertruck`. Solo documentación: no se cambió código. Contiene:
   - **La integración del Cybertruck (orden del usuario del 20-10):** no aparece en el entorno principal. Tendrá un botón propio (propuesta: «Cybertruck · Lab», tecla **U**) que lleva a un espacio aparte como el visor de `cybertruck`, sobre el patrón del Audi Lab retirado (`8e6a633`). Diseño, bloqueos y plan por fases: §4. Bloqueos: el GLB usa Draco y `vendor/` no tiene `DRACOLoader`, el decodificador ni `Reflector`; el visor carga de CDN; el Cybertruck en la escena principal rompería tres techos de `check.mjs`.
   - Hallazgos de este repositorio (S1–S14) y correcciones prioritarias (§6–§7).
   - **Mejoras de los modelos y de la simulación (§8):** reflejos locales (hoy todo refleja solo cielo y un suelo plano), sombras con penumbra (el `shadow.radius` no actúa con `PCFSoftShadowMap`), neumáticos del Porsche y de la H2R, caché de texturas, medir en la RTX 3070 del usuario…
   - Las decisiones pendientes del usuario: §9.
2. **Blender sin MCP (orden del usuario del 23-10-2026).** Ya no se usa el Blender de escritorio del usuario por MCP; deja de valer la «regla absoluta» del 15-10. Claude usa **su propio Blender sin interfaz** en el entorno del agente: Blender 5.2.2 LTS para Linux, la misma versión del usuario.
   - Instalación (comprobada el 23-10; conviene ponerla en el script de configuración del entorno):
     ```
     cd /tmp && curl -sSO https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
     curl -sS https://download.blender.org/release/Blender5.2/blender-5.2.2.sha256 | grep linux-x64 | sha256sum -c -
     tar xJf blender-5.2.2-linux-x64.tar.xz && export BLENDER=/tmp/blender-5.2.2-linux-x64/blender
     apt-get install -y libegl1 libegl-mesa0 libgl1-mesa-dri libxkbcommon0 libsm6 libxi6 libxrender1 libxxf86vm1 libxfixes3
     ```
   - Uso: `$BLENDER -b --factory-startup --python blender/<vehículo>/build.py` (o con un `.blend` delante). Sin las librerías EGL, Blender se cierra al usar EEVEE.
   - **Qué se pierde:** la RTX 3070 (en la nube solo hay CPU: el `build.py` de la H2R pasa de 7,4 min con OptiX a ≈30 min con 4 núcleos; EEVEE va por software) y ver la escena en vivo en el Blender del usuario (se revisa con renders a archivo).
   - **Qué se gana:** sin el corte de ≈100 s del MCP; sin riesgo de tumbar el Blender del usuario (ver la lección del 14-10 más abajo); reproducible con `--factory-startup` y versión fija.
   - Prueba real del 23-10 con el Cybertruck: reconstrucción completa en 331 s, validación idéntica y GLB equivalente. Detalle en la auditoría, §11.
   - Ojo: `bpy==5.0.1` (pip, Python 3.11), con el que se hizo la H2R, es otra versión. Para no mezclar, usar el binario 5.2.2 y pasar `node tools/check.mjs` tras regenerar cualquier `.glb`.

3. **CI: runner fijo en `ubuntu-24.04`** (23-10-2026). `ubuntu-latest` pasó a Ubuntu 26.04 y Playwright 1.56.1 no instala Chromium allí; el CI falló en las cinco ramas en ese paso, antes de cualquier prueba, con el commit de la auditoría. Se fijó la versión en `.github/workflows/pages.yml`. Pendiente, a decisión del usuario: actualizar Playwright y volver a `ubuntu-latest`.

### Estado actual (17-10-2026)

Cuatro órdenes del usuario ese día, en este orden, todas hechas:

1. **Retirar el Audi A3** (el modelo 3D, el Audi Lab y su documentación). Ya no existen `assets/audi/`, `src/ui/audiLab.js`, `tools/audi-lab-check.mjs` ni el documento de auditoría del 16-10. La historia de git no se reescribió: el Audi está en el commit `8e6a633`.
2. **Arreglar el rendimiento sin bajar la calidad de nada.** Cuatro cambios, todos con prueba: la descarga anticipada de los `.glb` (`core/prefetch.js`), la caché del mapa de sombras (`core/shadowCache.js`), la caché del buffer geométrico de la oclusión ambiental (`core/gbufferCache.js`, con `core/sceneSignature.js`) y el marcado de las piezas pequeñas de los tres coches de Blender para el gestor de detalle (`vehicles/lodParts.js`). Las cifras, lo que se midió y lo que se descartó (comprimir los `.glb`, niveles de detalle por sustitución de los neumáticos, texturas en hilos de trabajo) están en el README, «Ronda de rendimiento del 17 de octubre de 2026». **Sigue sin medirse en una GPU real ni en un móvil**: todo se midió en SwiftShader, que sirve para comparar versiones, no para dar FPS.
3. **Reorganizar la estructura de archivos sin perder documentación.** El README solo describe el estado actual; el diario de las rondas está en `docs/rondas/` (con un índice de dónde está cada sección que se cita por su nombre) y lo antiguo de este traspaso en `docs/traspaso/`. Se comprobó línea a línea que no falta ninguna del original (la única que cambió es el párrafo «Historial» del README, a propósito). De `main.js` salieron `core/layout.js`, `core/boot.js`, `ui/ruler.js` y `data/tour.js`; `tools/provenance-check.mjs` lee ahora las paradas de la visita de `data/tour.js` y el README junto con `docs/rondas/`.

4. **F-16: arreglar la banda oscura del fuselaje y repasar texturas y acabados** (después de las tres anteriores). Hecho solo en `src/materials/f16Textures.js`: líneas de pintura nítidas sobre costuras, paneles escalonados con registros, mosaico de alas sin cuadrícula. El usuario aconsejó usar Blender propio (no su escena por MCP): se instaló `bpy` 5.0.1 en un entorno aparte (`python3.11 -m venv` + `pip install bpy==5.0.1`) y se usó `blender/common/review.py` para revisar el F-16 exportado a glTF. Detalle en `docs/rondas/f16.md`.

**Comprobaciones nuevas** (todas en `npm run check`): `tools/perf-check.mjs` y `tools/render-cache-check.mjs` (sin navegador, en `check:static`), `tools/render-cache-equal.mjs` (`check:cache`, un trabajo más en CI: ya son cinco) y `tools/lod-parts.mjs` (dentro de `check:lod`).

**Si algo se ve raro en pantalla tras estos cambios**, los interruptores para comparar están en la consola: `__vc.shadowCache.enabled = false` y `__vc.gbufferCache.enabled = false` devuelven el dibujo de cada fotograma (con `__vc.renderer.shadowMap.autoUpdate = true` se recupera además el refresco propio de Three.js). Las piezas pequeñas (y todo lo que retira el gestor de detalle) dejan de retirarse con `__vc.lod.pixels = 0`.

**Pendiente, a decisión del usuario:** medir en hardware real; los niveles de detalle por sustitución de los neumáticos del Model Y (4 × 142 000 triángulos); si se quiere reordenar `tools/` en subcarpetas (no se hizo: las rutas `tools/…` están citadas en `CLAUDE.md`, en este traspaso y en el README); y partir los archivos de más de 1 500 líneas (`roadster.js`, `gt3rs.js`, `launch.js`, `plume.js`, y lo que queda de `main.js`).

### Estado actual (08-10-2026)

- **Qué es:** «SpaceX Vehicle Center 3D», una experiencia 3D a escala 1:1 en Three.js r170 (sin dependencias de CDN), publicada en https://alvarodesigns34.github.io/spacex/ (repositorio `alvarodesigns34/spacex`). Once expositores: Falcon 1, Starship, Falcon 9, Falcon Heavy, Dragon, Starlink, Roadster, Engine Row, F-16A, Porsche 911 GT3 RS y Kawasaki Ninja H2R. Los tres últimos se pilotan (F-16 en vuelo, Porsche y H2R en pista). No hay un objetivo fijo: el usuario dice en cada sesión qué toca.
- **Ramas y despliegue (comprobado el 08-10, tras la auditoría):** las seis ramas de trabajo están en el mismo commit (el de la auditoría del 08-10), el árbol limpio, y el CI y el despliegue de Pages en verde en las seis. Pages despliega desde `claude/spacex-vehicle-center-3d-48zlkm`. Al empezar, comprueba otra vez ramas y CI.
- **H2R: su modelo viene de Blender.** `assets/h2r/h2r.glb` (35,6 MB) lo genera `blender/h2r/build.py` y lo carga `src/vehicles/h2rAsset.js`; las físicas, el pilotaje, el sonido y las animaciones siguen en código y encuentran sus piezas por nombre (`h2r-steer`, `h2r-wheel-f-spin`, `h2r-wheel-r-spin`, `h2r-swingarm`, `h2r-impeller`, `h2r-dash`). Si el archivo no carga, entra el modelo en código (`src/vehicles/h2r/`), que además es la base de la que parte Blender. El resto de vehículos siguen siendo procedurales (sin binarios).
  - **Rehacer el `.glb`** (solo si cambia el modelo): `pip install bpy==5.0.1` (Python 3.11), `node tools/h2r-export.mjs` (navegador sin interfaz: escribe `blender/h2r/source/code-parts.glb`, que no está en el repositorio) y `python3 blender/h2r/build.py` (≈30 min con 4 núcleos, por el horneado de la oclusión ambiental). Para renders de revisión con Workbench o Eevee hace falta `libegl1` (`apt-get install libegl1 libegl-mesa0 libgl1-mesa-dri`); Cycles va sin él.
  - **Después de tocar el `.glb` o `blender/`**, pasa también `node tools/check.mjs` (escena), no solo `check:static`. El despliegue copia `assets/` (`h2r-check` lo vigila).
- **Audi A3 retirado (17-10-2026, orden del usuario):** ya no existen `assets/audi/`, el Audi Lab (`src/ui/audiLab.js`, botón y tecla **U**), `tools/audi-lab-check.mjs` ni el documento de auditoría del 16-10. No se reescribió la historia de git. Si el usuario pide recuperarlo, está en el commit `8e6a633`.
- **Comprobaciones:** `npm run check:static` antes de cada commit (≈2–3 min); `npm run check` completo (≈25–30 min, con navegador) al cerrar un bloque o la sesión; el CI hace el completo en cada push y no despliega si falla.
- **Presupuesto de la escena** (CI del 13-10, con el Tesla Model Y): 5.073.256 triángulos construidos, 3.963.703 dibujados en la vista general, 1.810 mallas, 354 materiales y 157 texturas, frente a los límites de `tools/check.mjs` (6 M, 2.600, 420 y 260; antes 4,5 M, 2.200, 340 y 220). El commit del Model Y (`8728971`) rompió CI por pasarse en triángulos y materiales y no se desplegó; se arregló subiendo los techos. **Lección:** un expositor nuevo desde un `.glb` suma de golpe; pasa `node tools/check.mjs` antes de empujarlo. Se pueden subir si hace falta.
- **Auditoría del 08-10-2026 (sobre `d2ea8e9`):** el informe está en `/mnt/project-files/auditoria/auditoria-2026-10-08.md` (fuera del repositorio; no se modifica). Cada hallazgo se comprobó en el código; el detalle, en el README, sección «Auditoría del 8 de octubre de 2026».
  - **Corregido:** B1–B9 (cámara y secuencias, rejillas de colisión tras elegir el expositor, sol durante la carga, nodos de audio, consejos, esperas de `ux-check`, cobertura y controles negativos de `lod-pop`, sabotaje «frozen» de `cloud-check`); A1 (carbono de dos caras de la H2R en código, sin tocar el `.glb`), A2 y A18 (la ficha separa lo trazado en OSM de lo construido, sin cifras nuevas), A3 (torre 149,35 m), A10, A11 (ruido periódico en `detail.js`, también el del cepillado), A16 y A19 (solo documentado en `plate()`), A17 y A22 (ventanas medidas sin navegador: pinzas a 22 mm, ventana hasta +4 cm; asiento a 0, ±5 cm), A20 (paso por par en la granja), A21, A23, A26, A27.
  - **Pendiente:** A4, A5, A6 y el código muerto del basculante (H2R aparcada; obligan a regenerar el `.glb`); A24 (año del Roadster, sin la fuente en el repositorio); A28 (costura del acero: todo el ruido de `makeSteel` es no periódico, la frecuencia entera no basta y el arreglo cambia todos los cascos). **No reproducido:** A25. A12, retirado.
  - `npm run check` completo en verde antes de empujar (código 0, 23 min; 3.900.168 triángulos construidos y 2.790.671 dibujados en la vista general, 1.681 mallas, 314 materiales y 156 texturas).
- **Encargo del 14-10-2026 (en curso):** mejorar los vehículos uno a uno en Blender (Blender 5.2.2 del usuario por MCP, RTX 3070 con OptiX): formas, piezas que faltan, texturas, acabados y proporciones 1:1, con el máximo detalle; se añaden los logotipos y rótulos que faltan; si hace falta, se sube el presupuesto de la escena. Repositorio local en `C:\Users\Álvaro\Documents\spacex`.
- **Pasada del 14-10-2026 (hecha; detalle en el README, «Pasada en Blender del 14 de octubre de 2026»):** orden del usuario: Model Y → H2R → Porsche, y parar al terminar los tres. Model Y: llantas Crossflow de 19" con 255/45 R19, rejilla inferior ancha, la «L» de los faros, TESLA bajo la matrícula. H2R: pintura de espejo oscura y paneles prensados subdivididos. Porsche: escudos y PORSCHE desde `assets/gt3rs/markings.glb`.
  - **Lección: no construir dentro de la sesión abierta de Blender del usuario.** (Desde el 23-10 ya no se usa el Blender del usuario: ver «Estado actual (23-10-2026)».) `object.join` y `shade_smooth_by_angle` por el puente MCP, con escenas vaciadas por script, la tumbaron varias veces (`BKE_base_eval_flags`, lectura de puntero nulo). Todo se construye con `"C:Program FilesBlender FoundationBlender 5.2lender.exe" -b --factory-startup -P …`; el MCP queda para mirar.
  - En Git Bash, las rutas que se pasan a Blender dentro de un argumento compuesto (`a.glb+b.glb`) tienen que ser de Windows (`pwd -W`).
  - El horneado de la H2R usa la RTX 3070 (OptiX) si está: 7,4 min el `build.py` entero.
  - **Segunda pasada (misma tarde):** el usuario pidió trabajar en su Blender por MCP. Método que funciona sin tumbarlo: cargar con `bpy.data.libraries.load` (colecciones de un `.blend` construido sin interfaz) o `import_scene.gltf` en una escena propia, editar con la API de datos, renderizar con `bpy.ops.render.render(scene=…)` (resoluciones y muestras moderadas: el puente corta a ≈60 s). Las superposiciones con cámara calibrada (matrícula + ruedas) están en el README; sirven para cualquier vehículo con una foto libre donde se vea una matrícula.
  - **Aparcado:** el Raptor 3 en Blender (`blender/raptor3/` y `blender/common/kit.py`, sin subir), empezado antes de fijar el orden; la referencia buena es la foto de SpaceX del primer Raptor 3 entre Raptor 2 (agosto de 2024): casi todo negro satinado.
- **Encargo del 15-10-2026 (en curso; detalle en el README, «Pasada profunda en Blender del 15 de octubre de 2026»):** el usuario pidió entonces rehacer a fondo en SU Blender abierto, por MCP (regla absoluta **hasta el 23-10**; desde entonces, Blender propio sin interfaz), en este orden: Model Y → Porsche → H2R → Roadster (coche y Starman; el adaptador de carga sigue en código). Hiperrealismo por encima del peso: el único tope es el de GitHub (100 MB por archivo). Permiso dado para descargar fotos de referencia a `scratch/` (nunca al repositorio). Al terminar los cuatro, avisarle.
  - **Método que funciona:** diseñar y revisar en la escena `MODEL_Y` de su Blender cargando los módulos `ty_*.py` con un pequeño script de sesión (`scratch/my/app.py`: `load_ns([...])` ejecuta los módulos en `bpy.app.driver_namespace['TY']` y deja `ns['_BODY']`), renders de Cycles por cámara (`ns['render_cam']`, ≈5 s a 1280 × 720 y 64 muestras en la RTX). La construcción final y el horneado, con `build.py` sin interfaz (6 min con la oclusión en la GPU). Fotos de referencia en `scratch/ref_my*`; `scratch/tools/crop.py` amplía zonas.
  - **Model Y, hecho:** llantas Crossflow, frontal (`ty_front3.py`), zaga (`ty_rear3.py`), volante, y el cierre para la web (`ty_bake.py`: modificadores aplicados con la API de datos, UV en metros, mapas de detalle periódicos, oclusión en atlas de 4096). El `.glb` pasa a 32,6 MB.
  - **Porsche, hecho:** `blender/gt3rs/build.py` (base: `node tools/vehicle-export.mjs gt3rs`), `parts/wheels.py` (cinco radios en Y, labio mecanizado, rótulos del Cup 2 R), oclusión con `blender/common/webfinish.py`; en la web, `vehicles/gt3rsAsset.js` (materiales de la biblioteca por nombre + aoMap del archivo, cabina viva del código, rótulos aparte; si falla, `loadGt3rs`). Revisión en la escena `GT3RS` del Blender del usuario con `scratch/my/rig.py` (sol, cielo, asfalto, `shot()`).
  - **H2R, hecha:** `blender/h2r/parts/wheels.py` (brazos plegados de dos tonos, rótulos Bridgestone Battlax V01), llamado desde `build.py`; `parts/bake.py` da un primer juego de UV a toda malla que no lo tenga (el silenciador, el colector y el River Mark leían la oclusión de un canal que no tenían). Revisión en la escena `H2R` del Blender del usuario. Las «fases 3» de materiales ya estaban en la web como recetas (`detailSpec`).
  - **Ojo al importar módulos `parts` en el Blender abierto:** los tres vehículos tienen un paquete `parts`; con `sys.path` Python cogió el de la H2R cuando se pedía el del Roadster (y rehízo las ruedas de la moto). Cargar por ruta: `importlib.util.spec_from_file_location`.
  - **Lecciones:** la inversión (y, z) → (xi, v) del morro solo existe para y ≥ 0 (lo que cruza el eje se construye por la mitad y se refleja); un cortador booleano necesita estar en el marco del coche (la raíz está en x = −WB/2) y ser cerrado: las tapas rellenas con `triangle_fill` en formas cóncavas dejan aristas sueltas, mejor «escaleras» entre dos cadenas; el exportador glTF no escribe la rugosidad conectada a un ruido (sale 1,0) y escribe el brillo de tejido sin su peso; con el panel del navegador oculto la simulación no termina de cargar (`tabs_select` para traerlo delante).
- **Pendiente, con el orden que decida el usuario:**
  - **H2R, aparcado:** el resto de la fase 3 (materiales con mapas propios: carbono, titanio, goma, aluminio y el espejo ahumado en dos capas), la mecánica refinada pieza a pieza y la forma del carenado contra las fotos. No retomarlo sin que lo pida. Sin fotos del amortiguador trasero, no se ha inventado su disposición.
  - **F-16:** tren (puertas planas, patas cilíndricas), luces de formación, receptáculo de repostaje, más paneles. El despegue con postcombustión (172 kt a 407 m) puede ser ≈15 % largo según una fuente secundaria; sin fuente primaria no se ha tocado. En tierra, a ≈120 kt, el alabeo a fondo con la palanca adelante tumba el avión sobre un ala (con los mandos simples no pasa).
  - **Porsche:** afinar el frontal (paragolpes algo abombado en las esquinas).
  - **Física y entorno en general:** el encargo amplio del 04-10 (conducción y vuelo, entorno, pasada final de bugs y físicas) sigue abierto.
  - **Decisión abierta del usuario:** la orientación del Pad 2 está en espejo respecto a la geografía real (ver «Lo que NO se terminó»).
  - **Galería de capturas:** sin regenerar; esperar a que el usuario lo apruebe.
- **Reglas que más se rompen:** español siempre; no crear pull requests; empujar cada commit a las seis ramas y comprobar el despliegue; escala 1:1 y solo medidas verificables, lo aproximado marcado con ≈; flujos, subagentes y esfuerzo los decide el usuario en cada tarea, sin configuración fija. Detalle en la sección 0 y en `CLAUDE.md`.
- **Herramientas locales:** el Anexo de abajo recrea `_frames.mjs`, `_probe.mjs`, `mk.py`, `ortho.py`, `blend.py`, `seg.py`, `mgrid.py`, `p2m.py`, `vol.js` y `empty.js`. Los scripts `tools/_*.mjs` no se suben (están en `.git/info/exclude`).

### Sesión del 05-10-2026 (quinta, rama `claude/youthful-noether-0ihafx`): la H2R «nivel Blender, literalmente»

- **Orden del usuario:** «En esta iteración quiero que te centres al máximo en la H2R. Ahora sí, nivel blender pero literalmente. Organiza el código en diferentes archivos por piezas si es más cómodo. DETALLE ABSOLUTO.» El encargo amplio (F-16, Porsche, entorno, físicas) sigue de fondo.
- **Método, sistema a sistema** (un commit por sistema, todos empujados a las seis ramas, con CI y despliegue en verde):
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
- **La H2R pasa a Blender (orden del usuario): ver el README, «La H2R pasa a Blender».** Lecciones:
  - Tras cambiar el `.glb`, pasa también `node tools/check.mjs` (escena), no solo `check:static`: la fase 2 llegó a CI con caras de área UV nula (los cantos del grosor y el bisel) y no se desplegó.
  - `GLTFLoader` quita los puntos de los nombres: el `.001` de Blender llega como `001`.
  - El empaquetado UV conjunto de 37.000 islas deja el atlas casi vacío: atlas por pieza con estantes (`parts/bake.py`).
  - Con 4 núcleos, un horneado de oclusión tarda >30 min: en segundo plano y sin pruebas a la vez.
  - `pkill -f` con un patrón que aparece en la propia orden mata el shell (código 144).
- **Estado de la H2R en Blender (05-10, tarde):** fases 1 (cadena de trabajo), 2 (carenado con grosor y bisel) y la oclusión ambiental de la 3, hechas y empujadas (`727baff`); el `.glb` pesa 35,6 MB. **PENDIENTE, aparcado por el usuario:** el resto de la fase 3 (materiales con mapas propios: carbono, titanio, goma, aluminio, espejo ahumado en dos capas), la mecánica refinada pieza a pieza y la forma del carenado contra las fotos. No retomarlo sin que lo pida.

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
- **Flujos y subagentes:** en esa sesión el usuario pidió no usarlos; no es una regla permanente (ver más abajo: los decide él en cada tarea).

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
- **Flujos, subagentes y esfuerzo:** Flujos de trabajo (`Workflow`), subagentes (`Agent`), nivel de esfuerzo, `ultracode` y demás modos o ajustes de Claude Code: **los decide el usuario en cada tarea y punto; no hay configuración fija ni regla permanente.** Haz lo que diga en ese momento y, si no dice nada, trabaja directamente tú. (En la tercera sesión pidió no usar flujos multiagente: valía para aquella tarea.)
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

---

## Dónde está el resto de este documento

Desde el 17-10-2026 este archivo solo lleva lo vigente: «Empieza aquí» (arriba) y las secciones 0 a 5 (abajo). Lo demás se movió **sin cambiar su texto** a [docs/traspaso/](docs/traspaso/README.md):

- **Traspasos de las sesiones del 29-09 al 04-10-2026** (segunda sesión del 04-10, estado al 03-10, proyectos en curso del F-16 y del Porsche, las órdenes del 02-10, las auditorías de entonces, «Al retomar», lo que no se terminó): [docs/traspaso/sesiones-anteriores.md](docs/traspaso/sesiones-anteriores.md).
- **Anexo: herramientas locales** (scripts que no están en el repositorio, cómo rehacerlos): [docs/traspaso/anexo-herramientas.md](docs/traspaso/anexo-herramientas.md).

Las secciones del README que este archivo cita por su nombre («*Auditoría del 30 de septiembre de 2026*», «*Encargo del 4 de octubre (cuarta sesión)*», «*La H2R pasa a Blender*»…) se movieron a [docs/rondas/](docs/rondas/README.md); su índice dice en qué archivo está cada una.

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
7. **Prohibido** (los logotipos y rótulos del vehículo real se permiten desde el 14-10-2026, orden del usuario):
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
