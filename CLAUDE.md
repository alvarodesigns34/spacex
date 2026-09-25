# Instrucciones para Claude

- **Idioma:** habla SIEMPRE en español con el usuario, sin excepción. Ni una palabra en inglés en los mensajes, resúmenes, preguntas, avisos de progreso ni descripciones de comandos. (El texto de la interfaz de la simulación sigue en inglés, y los comentarios del código siguen el estilo del código existente.)
- El README se escribe en español y se actualiza con cada cambio.
- No crear pull requests. Empujar a las tres ramas: `claude/dreamy-bell-qn1eth`, `grok/sun18-audit-10c9929` y `claude/spacex-vehicle-center-3d-48zlkm`, y comprobar el despliegue de Pages.
- No regenerar la galería de capturas hasta que el usuario lo apruebe.
- Escala 1:1, solo medidas verificables, y las aproximaciones marcadas como tales. Sin banderas ni logotipos nuevos, sin plataformas de lanzamiento extra, sin modo noche, sin plantas ni objetos nuevos en el entorno.
- Antes de cada commit, `npm run check` tiene que terminar con código 0.
