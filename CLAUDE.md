# Instrucciones para Claude

- **Idioma:** habla SIEMPRE en español con el usuario, sin excepción. Ni una palabra en inglés en los mensajes, resúmenes, preguntas, avisos de progreso ni descripciones de comandos. (El texto de la interfaz de la simulación sigue en inglés, y los comentarios del código siguen el estilo del código existente.)
- El README se escribe en español y se actualiza con cada cambio.
- No crear pull requests. Empujar cada commit a las cinco ramas: `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929`, `claude/elegant-ptolemy-l99qgo`, `claude/affectionate-euler-o447rh` y `claude/spacex-vehicle-center-3d-48zlkm` (más la rama de la sesión, si el sistema asigna otra), y comprobar el despliegue de Pages.
- Para empezar o retomar el trabajo, lee `TRASPASO.md` (sección «Empieza aquí»).
- No regenerar la galería de capturas hasta que el usuario lo apruebe.
- Escala 1:1, solo medidas verificables, y las aproximaciones marcadas como tales. Sin banderas ni logotipos nuevos, sin plataformas de lanzamiento extra, sin modo noche, sin plantas ni objetos nuevos en el entorno. (Única excepción a los logotipos: los rótulos de fábrica de la Kawasaki Ninja H2R.)
- Las fotos con derechos de autor solo como referencia, nunca en el repositorio; nunca eludir protecciones antibots ni límites de peticiones; el email del usuario nunca va a servicios externos.
- **Comprobación por niveles** (orden del usuario del 03-10-2026):
  - Antes de cada commit, `npm run check:static` (lint, procedencia y las pruebas de física de todos los vehículos, ≈2–3 min) tiene que terminar con código 0.
  - El `npm run check` completo (≈25–30 min, con navegador) se ejecuta una vez al cerrar cada bloque de trabajo o al final de la sesión, antes del último push.
  - CI ya ejecuta el check completo en cada push y no despliega si falla: tras empujar, comprueba que los trabajos y el despliegue salen en verde y, si algo falla, arréglalo enseguida.
