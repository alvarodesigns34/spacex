# Dos auditorías externas del 13-11-2026: síntesis y trabajo hecho

El usuario entregó dos auditorías independientes del commit `b6075e7` (una de Gemini, pegada en el encargo; otra de GPT, en `docs/auditorias-externas/2026-11-13-gpt.md`) y pidió contrastarlas con el código, sintetizarlas y empezar a transformar el proyecto. Este documento dice qué se comprobó, qué se hizo, qué está verificado y qué no.

**Dónde se trabajó:** un contenedor en la nube, sin GPU (render por software, SwiftShader). El PC del usuario no estaba conectado. **Nada de esta sesión está medido en la RTX 3070**: lo que sigue distingue lo comprobado por prueba, lo comprobado mirando capturas y lo que queda por medir.

## 1. Contraste de las dos auditorías

| Hallazgo | Gemini | GPT | Comprobado en el código | Qué se hizo |
|---|---|---|---|---|
| Un cambio de luz no renueva todo el historial de nubes | ERR-01 | C03 | Sí: `uMix = 1` un solo fotograma, 1 píxel de cada 16 | Corregido, con prueba |
| Distancia «sin nube» 1e5 en un float de 16 bits | — | C02 | Sí: se guardaba como infinito e invalidaba la reproyección en los bordes | Corregido |
| Historial emborronado por lectura bilineal repetida | ERR-01 | D5 | Plausible por construcción; no medido | Filtro Catmull-Rom de 5 lecturas |
| El mar se hunde al estirar el suelo en el ascenso | ERR-02 | — | Sí: −0,9 → −30,6 m, y las dunas 34 veces más altas | Corregido |
| G-buffer solo mira el primer material de una malla | ERR-03 | — | Sí | Corregido (`drawsDepth`) |
| AO/SSR sin el oleaje; doble reflejo del SSR | ERR-03 | D6, C15 | Sí por lectura; AO y SSR están apagados en el lanzamiento | **Pendiente** |
| `seek()` recalcula la luz de la nube en cada tick | ERR-04 | — | Sí: 1 200 pasadas para T+40 | Corregido (una al final) |
| Brillo de reentrada igual a barlovento y sotavento | ERR-05 | H12 | Sí: un escalar por material | Corregido (por fragmento, según la cara al flujo) |
| Marcha atrás del Porsche bloqueada | ERR-06 | — | Sí | Corregido, con prueba |
| Rueda oscilando con el freno pisado en parado | ERR-07 | — | Sí | Corregido, con prueba |
| El AO de la carrocería en la tela de la cabina | ERR-08 | — | Sí | Corregido |
| Rueda delantera de la H2R gira bloqueada; basculante sin el reposo | ERR-10 | — | Sí | Corregido |
| Depósito de freno trasero de la H2R opaco | ERR-11 | — | Sí, en los scripts | **Pendiente** (exige regenerar `h2r.glb`) |
| URLs de `AudioWorklet` sin revocar | ERR-12 | — | Sí (tres motores, no dos) | Corregido |
| Partículas subidas a la GPU sin nada vivo | ERR-13 | — | Sí | Corregido |
| Factor de carga del F-16 con el peso de referencia | F-16 | C05 | Sí | Corregido, con prueba |
| El F-16 quema más combustible del que queda | — | C06 | Sí | Corregido, con prueba |
| Falta −vx·vh/r en el ascenso de la nave | — | C04 | Sí | Corregido, con prueba y sabotaje de control |
| Clave de caché de texturas incompleta | — | C01 | Sí | Corregido (`texCore.js`, `geometry/utils.js`) |
| Una nube destruye la textura compartida | — | C10 | Sí | Corregido |
| Doble conversión de color en plumas y reentrada | — | C14 | **Sí**: 0x808080 → 0,216 una vez, 0,038 dos (three.js r170 vendorizado) | **Pendiente**: cambia la paleta; hay que enseñarlo antes y después |
| La física de reentrada importa el adaptador visual | — | C17 | Sí | Corregido |
| Los pases no restauran el renderer si fallan | — | C11 | Sí | Corregido en la marcha de nubes y en el pase nuevo; **pendiente** en AO |
| Nube de suelo: tarjetas sin orden, pluma siempre encima | D.4 | C09, H08 | Sí | **Sustituida por un volumen** (§2) |
| Plumas cortadas en línea contra la plataforma | D.4 | D7 | Sí | Fundido suave contra la profundidad (§2) |
| Cascadas de sombras, atmósfera Hillaire, océano FFT, AgX | D.2–D.3 | H09–H10 | — | **No hecho** (§4) |
| Integrador 6-DOF, guiado ZEM/ZEV, Tierra en rotación | E | H06–H07 | — | **No hecho** (§4) |

**Discrepancias resueltas.** Gemini da tiempos por pasada para la RTX 3070 (su §G.2) y un objetivo de arranque «< 4 s»; no los midió, y GPT acierta al tratarlos como hipótesis. No se ha usado ninguna de esas cifras. Gemini propone cascadas de sombras para ahorrar un 60 %; la medida real del 11-11 (`docs/rendimiento-2026-11-11.md`) dice que sombras y PCSS casi no pesan, así que no es una prioridad de rendimiento, solo de nitidez. Gemini da por malo el orden de `stillAA` y las nubes; es un desfase de un fotograma en un tramado que solo se acumula con la cámara quieta, sin efecto apreciable: no se tocó.

**Hallazgos propios, que ninguna de las dos traía:**
- Con la distancia ya representable, un corte de cámara (un salto de vista, un `seek`) reproyectaba el historial de otra vista como válido. Ahora un salto de más de 60 m o 25° en un fotograma lo descarta (`cloudsTemporal.js`).
- La distancia del historial ocupaba cuatro canales de 16 bits para un número: ahora uno (`R16F`), ≈ 79 MB menos a 3440 × 1440 **según los formatos, no medido**.
- En three.js r170, un destino multimuestra se invalida al resolverse: dibujar dos veces en el mismo búfer del compositor pierde lo primero en una GPU real (el render por software no lo muestra). El pase nuevo se diseñó para no hacerlo.

## 2. La nube de ignición, ahora un volumen

`src/sim/cloudVolume.js`. La simulación de las bocanadas no cambia (determinista: un `seek` da la misma nube). Cambia lo que se dibuja:

1. **Densidad:** las bocanadas vivas se vuelcan cada tick en una textura 3D (celdas de 6 m, 960 × 384 × 1 152 m), vapor y polvo en canales distintos. En la GPU.
2. **Luz:** un segundo volumen a media resolución con la luz del Sol que llega a cada celda a través del resto de la nube, y lo mismo hacia el fuego de la trinchera. Sustituye al `selfShadow()` de la CPU.
3. **Imagen:** un pase tras la escena marcha cada rayo entre la cámara y lo que la escena dibujó allí (su profundidad), acumulando extinción y luz. La superficie es un nivel del campo que un ruido 3D desplaza: de ahí las volutas.
4. **Plumas, llamas y vapor del vehículo:** se dibujan después, atenuados por el vapor que tienen delante (no por el de detrás) y fundidos contra la geometría en vez de cortados.

Imágenes del mismo instante y cámara, antes y después, en `docs/antes-despues/2026-11-13-nube-volumetrica/` (render por software, 960 × 540, nubes del cielo con la marcha corta de la automatización).

**Comprobado mirando capturas:** masa continua desde el lateral, de cerca, desde arriba y a lo largo de la trinchera; sin tarjetas ni líneas contra la plataforma, la torre o el suelo; el depósito de tanques delante la tapa; el fuego de la trinchera queda parcialmente oculto por el vapor de delante.

**No comprobado:** el coste en la RTX 3070. El pase solo existe durante el lanzamiento y cada rayo se detiene al 1 % de transmitancia, pero es una marcha a resolución completa. `?gpu` lo mide aparte («cloud volume», «plumes and steam», «cloud volume compose»); `?off=cloudvolume` devuelve las tarjetas para comparar. **Hay que pasar `npm run bench:gpu` en el PC del usuario antes de darlo por bueno.** Tampoco se ha visto en movimiento a 60 fps ni con la cámara dentro de la nube.

**Límites conocidos:** las estelas del ascenso, el vapor del conteo y el del aterrizaje siguen siendo tarjetas (clase `Vapor`); el volumen es una caja fija sobre la plataforma; no hay acumulación temporal propia, así que queda un tramado fino en los bordes.

## 3. Lo demás que cambió

- **Física:** el término −vx·vh/r del ascenso cambia la masa no propulsiva que resuelve el ajuste: de ≈ 209,05 t a ≈ 205,00 t. Es un parámetro ajustado, no una medida; no se ha retocado nada para conservar el valor anterior.
- **Pruebas nuevas** (todas en `check:static`): marcha atrás y freno en parado del Porsche, factor de carga y última gota del F-16, arco libre con conservación de momento angular y energía (y su sabotaje `frame`), cambio de Sol en las nubes temporales.

## 4. Lo que no se ha hecho

No se ha tocado, y sigue siendo trabajo real: atmósfera física de suelo a órbita, océano multiescala y su coherencia con AO/SSR, cascadas de sombras, plumas volumétricas con celdas de choque dependientes de la presión, distorsión térmica, plasma de reentrada, integración 6-DOF con Tierra en rotación y guiado cerrado, tablas supersónicas y centro de gravedad variable del F-16, suspensión por rueda del Porsche, modo sin ayudas de la H2R, arranque (texturas en *workers*), partir `main.js` y los monolitos, el Cybertruck Lab dentro de `ViewState`, el Model Y que queda vacío si falla su carga (C13), y toda la geometría y los materiales por vehículo. Tampoco se ha instalado Blender ni regenerado ningún `.glb`.
