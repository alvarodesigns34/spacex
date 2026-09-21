# SpaceX Vehicle Center — auditoría visual (pass grok/vehicle-center-visual-pass)

Partida: `f71bb82` *Rebuild the Falcon 1 exhibit* en `claude/spacex-vehicle-center-3d-48zlkm`.
Escala: 1 unidad = 1 metro. Falcon 1 es el suelo de calidad y no se tocó.

## Scorecard (antes → después de este pass)

| Sistema / vehículo | Antes | Después | Nota |
|---|---|---|---|
| Starship | 4 | 8 | Grid fins verticales y plegables, pines en ±Z, hot-stage vented, raceway en φ, falda mill, RVac colgando, bisagras del ogive |
| Pad | 6 | 8 | Labio bajo la falda; zanja ya no se oculta por LOD |
| Falcon 9 | 6 | 7 | Octaweb con placa y recortes, interstage con anillos, raceway de bandeja |
| Falcon Heavy | 5 | 7 | Puntales más gruesos + viga de empuje común a la cota del octaweb |
| Dragon | 7 | 7 | UVs métricas en las aletas del trunk |
| Starlink | 6.5 | 7.5 | Bus MLI, células solares a escala, dos Hall |
| Engine Row | 5.5 | 7 | Raptor 3 cerrado, RVac gris, Merlin con dump curvo |
| Roadster | 8 | 8 | UVs del neumático alineadas con el mapa |
| Falcon 1 | 9 | 9 | Sin regresiones (44 092 tris, 70 mallas, 21.336 m) |
| Materiales / LOD / cámara | 8 | 8.5 | Mapas por nivel de calidad, polos de lathe, overview más bajo |

## Hallazgos P0 que este pass cierra

1. **Grid fins de Super Heavy eran estantes horizontales.** `gridFin` construye span en +X y profundidad en +Y. Falcon 9 aplica `rotation.set(0, π/2, π/2)`. Starship no lo hacía. El preset `gridfins` miraba una waffle de 42 cm de alto.
2. **El asiento del pad era un agujero más grande que el vehículo.** `throatR = RAPTOR_ENVELOPE_R + 0.25 = 4.73 m` contra una falda de 4.50 m. La comprobación de interfaz solo miraba Y. Ahora hay un labio a `BOOSTER_R − 0.08` y una garganta aparte para las campanas.
3. **Raceway de Super Heavy a 180° mientras las chines usan `RACE_PHI`.** 40° de desfase. Alineado.
4. **Azimut de los pines de captura vs. los chopsticks.** Con yaw 129.6° los pines quedaban ~40° fuera del plano de los brazos. El gate de altura pasaba (desfase Y −0.84 m). Los fins compensan el yaw para sentar los pines en el ±Z de la torre. `STARSHIP_YAW_DEG` vive en un solo sitio.

## P1 cerrados

- Hot-stage: tubos de revolución sectorizados (huecos de verdad) en lugar de cajas pegadas a un cilindro cerrado.
- Falda de Starship: `M.steelShip` (mill + tinte leve), no el calcetín tiznado de Super Heavy.
- TPS: el wrap a 180° ya no salta a 3.4 m del morro; solo el último metro.
- Anillo de cúpula común de la nave, que la ficha ya señalaba.
- Octaweb del Falcon 9: placa aft con nueve recortes; el techo baja al nivel de las bombas.
- Interstage F9: `lodFeature` 0.22 para que el empalme se lea en su propia cámara; anillos de panel.
- Raptor 3: cabezal cerrado. RVac: campana `bellCool`, aros solo en Engine Row. Merlin 1D: dump de turbina curvo.
- Starlink: `boxUV` en paneles, bus en MLI, dos Hall.
- Zanja: el deflector ya no se oculta como pieza de 30 cm.
- Texturas: el nivel `low`/`medium` reduce píxeles, no UVs.
- Overview: cámara más baja, mira a la cubierta.
- RVac de la nave: hang −0.85 m, campanas en el anillo de hot-stage, no enterradas en la falda. Preset `ship-engines`.
- Bisagras de flaps delanteros: tubo que sigue el ogive en lugar de una cápsula a radio constante.
- 13 Raptor interiores: `ringLayout(..., { tilt: 0.055 })`. Los 20 del anillo exterior siguen axiales.
- Grid fins de SH: se pliegan en el despegue y se despliegan para el landing burn. El pin de captura no se mueve con el waffle.
- Falcon Heavy: viga de empuje continua a la cota del octaweb (`fh-octaweb-beam`). No se oculta por LOD.

## P2 / siguiente iteración

- FH sigue siendo tres núcleos + herrajes; la viga une la base, no rediseña el octaweb como una sola pieza mecanizada.
- El cant de 0.055 rad de los Raptor interiores es *aproximado* (fotos, no cifra publicada).
- El plegado de las grid fins es una rotación de 90° sobre el eje del vehículo, no el cinemático real del actuador interno.
- Roadster no se reescribió.

## Criterios de aceptación de este pass

- `node tools/hardware-check.mjs` y `node tools/cloud-check.mjs` en verde (incluye AABB de grid fin > 3 m, dos pines, viga FH).
- `node tools/check.mjs`: 124 m / 9 m / 33+3+3 Raptor, falda sobre el labio, campanas caben en la garganta, pines frente a los chopsticks, 47 vistas, lanzamiento determinista, reset idéntico, consola limpia.
- `node tools/ux-check.mjs`: 390×844, 844×390, 768×1024, 1366×768, 1920×1080, DPR 2, Help trap.
- Falcon 1: 21.336 m, 1.6764 m, cofia 3.50 × 1.54, Merlin 1C y corte intactos (44 092 tris, 70 mallas).
- Grid fin AABB: altura > 3 m.
- `?quality=low` genera mapas más pequeños; las UVs métricas no cambian.

## Métricas (calidad high, SwiftShader)

| | Partida (brief) | Este pass |
|---|---|---|
| Tris construidos | 1 264 058 | 1 243 426 (−1.6 %) |
| Tris dibujados (overview) | 729 243 | 695 663 |
| Mallas construidas | 979 | 1 010 |
| Materiales | 101 | 102 |
| Texturas lógicas | 58 | 60 |
| Texturas MB (est.) | 118.2 | 124.2 |
| Starship tris / mallas | 639 448 / 74 | 594 868 / 99 |
| Falcon Heavy tris / mallas | 132 360 / 129 | 150 420 / 130 |
| Falcon 1 tris / mallas | 44 092 / 70 | 44 092 / 70 |
| Engine Row tris | 32 992 | 29 416 |

Los tiempos de frame en SwiftShader no representan GPU real.

## Fuentes

Sin cifras nuevas presentadas como oficiales. El labio del pad, el hang de 0.38 m de los Raptor de Super Heavy, el hang de −0.85 m de los RVac de la nave, el azimut de las chines, el cant interior y la viga FH siguen en *aproximado*. El yaw 129.6° es una decisión de exposición, no un roll publicado de apilado.
