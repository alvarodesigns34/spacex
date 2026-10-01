# Traspaso de contexto: SpaceX Vehicle Center 3D

Hola, Claude. Continúas un proyecto que llevo trabajando contigo durante muchas sesiones. Aquí tienes todo lo necesario para seguir exactamente donde lo dejamos, con los mismos criterios y la misma forma de trabajar. Léelo entero antes de hacer nada.

---

## ⭐ Empieza aquí (estado real al 01-10-2026: X-15 retirado, F-16 en marcha)

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
   - La pista ya existe como máscara del terreno (`RUNWAY`, `toRunway` y `fromRunway` en `terrain.js`: 2.743,2 × 45,72 m, a 30°). El avión está a 40 m del umbral de la 13.
   - Las capturas de comprobación se hacen fuera del repositorio. La galería **no se regenera hasta que el usuario lo confirme**.
4. Complejo de la pista: **hecha**, commit «F-16 phase 4: runway 13/31 with FAA markings».
   - `src/core/runway.js`: `buildRunway(M)` y `runwaySurface(a, c)`, la altura del pavimento en coordenadas de pista. Sirve para posar el avión y, en la fase 5, para el contacto de las ruedas.
   - Marcas según la FAA AC 150/5340-1M, descargada a la carpeta temporal.
   - En coordenadas de pista, +c queda a la derecha de +a, hacia el suroeste. El comentario antiguo de `terrain.js`, que decía noreste, se corrigió.
5. Modelo de vuelo de 6 grados de libertad (TP-1538 y TP-3355, F100, *fly-by-wire*, tren).
6. Modo de vuelo: despegue, vuelo, aterrizaje, cámaras, cabina y HUD.
7. Revisión, README, galería.

Fuentes descargadas para consulta, fuera del repositorio (en la carpeta temporal de la sesión; se pueden volver a bajar de NTRS):
- **NASA TP-1538** (Nguyen et al., 1979), NTRS 19800005879: tabla I (peso 20.500 lb; Ix 9.496, Iy 55.814, Iz 63.100, Ixz 982 slug·ft²; envergadura 30 ft, 300 ft², cuerda media 11,32 ft; centro de gravedad de referencia 0,35 c̄), tabla III (aerodinámica, α −20…90°, β ±30°), tabla VI (empuje en ralentí, militar y máximo, de 0 a 50.000 ft y de Mach 0,2 a 1,0) y apéndice A (mandos de vuelo).
- **NASA TP-3355** (1993), NTRS 19930022544: F-16C y un derivado, de Mach 1,6 a 2,16, con planos de tres vistas.
- **Hueco:** no hay datos públicos del F-16 en la zona transónica (Mach 0,6–1,6), ni de empuje por encima de Mach 1. Habrá que interpolar y marcarlo como ≈.


### Al retomar

1. `git fetch --all` y comprueba:
   - que las cuatro ramas (`claude/spacex-vehicle-center-3d-48zlkm`, `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo`), y `claude/affectionate-euler-o447rh`, apuntan al mismo commit, el último con este TRASPASO;
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
  - sin pull requests: el mismo commit a las **cuatro ramas**;
  - **`npm run check` con código 0 antes de cada commit**, sin excepción;
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

- **Galería:** aprobada por el usuario el 29-09, pero **no regenerada**. La ejecución se paró a medias y se restauró `docs/`. Cuando el usuario lo apruebe de nuevo:
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
2. **No crear pull requests.** Empujar siempre el mismo commit a estas **cuatro ramas** (y a la de la sesión, si te asigna otra):
   - `claude/dreamy-bell-qn1eth`
   - `grok/sun18-audit-10c9929`
   - `claude/elegant-ptolemy-l99qgo`
   - `claude/spacex-vehicle-center-3d-48zlkm` (la rama por defecto; la que despliega Pages)
3. **Antes de cada commit, `npm run check` tiene que terminar con código 0.** Tarda unos 25 minutos. Nunca confirmes sin él.
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
- **Push a las cuatro ramas con reintentos:**
  ```
  for b in claude/dreamy-bell-qn1eth grok/sun18-audit-10c9929 claude/elegant-ptolemy-l99qgo claude/spacex-vehicle-center-3d-48zlkm; do for d in 2 4 8 16; do git push -q origin HEAD:$b 2>/dev/null && { echo "ok $b"; break; } || sleep $d; done; done
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

---

Cuando hayas leído todo, sigue la sección «Empieza aquí»: comprueba ramas, CI y Pages, y espera a que te diga qué priorizar. Si hace tiempo de la última auditoría (la del 30-09), propón repetirla con la misma lista.
