# Instrucciones para Claude

Reglas vigentes, cada una con su porqué. Lo histórico está en `TRASPASO.md` y en `docs/rondas/`.

## Comunicación
- **Siempre en español con el usuario**: mensajes, resúmenes, preguntas, avisos y descripciones de comandos. El usuario solo habla español. La interfaz de la simulación y los comentarios del código siguen en inglés.
- Una línea al empezar, avisos breves mientras se trabaja y, al final, un resumen que se entienda solo: qué se encontró, qué se hizo, qué está comprobado y qué no, y qué falta. Si algo no se pudo medir o verificar, se dice así.
- Cuando algo cambie lo que se ve, una imagen de antes y después en `docs/`.

## Empezar o retomar
- Lee este archivo, después `TRASPASO.md` («Empieza aquí») y del `README.md` «Estado actual» y «Estructura».
- Comprueba que las seis ramas están en el mismo commit y que el último CI y el despliegue de Pages están en verde. Si la copia local tiene cambios sin subir de otra sesión, guárdalos en una rama local antes de tocar nada.
- No hay objetivo fijo: el usuario dice en cada sesión qué toca. Flujos, subagentes y nivel de esfuerzo los decide él en cada tarea; si no dice nada, trabaja directamente.

## Git y comprobaciones
- Sin pull requests. Al cerrar un bloque, el mismo commit va a las seis ramas: `claude/spacex-vehicle-center-3d-48zlkm` (la que despliega Pages), `claude/vigilant-bohr-mlvmxf`, `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo` y `claude/affectionate-euler-o447rh`, más la de la sesión si es otra. Porque el usuario sigue el proyecto desde todas ellas.
- Commits en inglés con el pie de atribución que indique el sistema; comentarios del código en el estilo del que hay. Lee el código de alrededor antes de añadir nada.
- `npm run check:static` (lint, procedencia y física, ≈2–3 min en Linux, más en Windows) antes de cada commit. El `npm run check` completo (≈25–30 min, con navegador) al cerrar cada bloque, antes del último empuje. El CI lo vuelve a pasar en cada empuje y no despliega si falla: tras empujar, comprueba que todo sale en verde y, si algo falla, arréglalo enseguida. Un empuje nuevo a `…48zlkm` cancela el CI en marcha de esa rama.

## Rendimiento
- El usuario quiere ganar calidad, no perderla, y que funcione bien en su RTX 3070 a 3440 × 1440. Nada de calidad adaptativa ni bajadas automáticas de nivel; las mejoras de rendimiento vienen de técnicas más inteligentes y de medir.
- **Medir en GPU real antes de opinar.** Si la sesión corre en el PC del usuario (Windows, RTX 3070), `npm run bench:gpu` mide con su GPU (`docs/rendimiento-2026-11-11.md`). Las cifras de SwiftShader (contenedor y CI) no valen para rendimiento.
- Si una mejora de rendimiento cambiaría la imagen, se enseña antes y después y se habla con el usuario.

## Contenido
- Escala 1:1, solo medidas verificables, y las aproximaciones marcadas (≈, «reconstruido», `approx: true`): es una exposición técnica y su valor es que lo que muestra sea cierto o diga que no lo es.
- El propulsor acaba en los brazos de la torre; al mar solo va la nave.
- Sin plataformas de lanzamiento extra, sin modo noche y sin objetos nuevos en el entorno (plantas, decorado). Si algo nuevo mejoraría la escena de verdad, se propone.
- Logotipos y rótulos: sí los que lleva el vehículo real, fieles a las fotos y a escala.
- Fotos con derechos de autor solo como referencia, nunca en el repositorio. Nunca eludir protecciones antibots ni límites de peticiones. El email del usuario nunca va a servicios externos.
- No regenerar la galería de capturas (`docs/screenshots`, `docs/hud`, `npm run shots`) sin la aprobación del usuario.

## Herramientas
- **Blender 5.2.2.** El Blender de escritorio del usuario responde por MCP (comprobado el 11-11-2026, a petición suya); también vale Blender sin interfaz con los scripts de `blender/` (`blender -b --factory-startup --python …`). Los `.glb` que salen de Blender (H2R, Model Y, Porsche) se generan desde esos scripts; el pilotaje, la física, el sonido y las animaciones siguen en código y buscan sus piezas por nombre. Si cambias un `.glb` o `blender/`, pasa también `node tools/check.mjs`.
- **El Cybertruck Lab** (tecla U, `src/ui/cybertruckLab.js`) trae su GLB del repositorio `cybertruck` con `node tools/cybertruck-sync.mjs`; si cambia allí, vuelve a sincronizar y pasa `node tools/cybertruck-check.mjs` y `npm run check:cybertruck`.
- **three.js r170** con parches de fragmentos (`core/pcss.js`, `core/fogSun.js`) que fallan al arrancar si three.js cambia: actualizarlo exige rehacerlos.
