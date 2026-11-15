# Ronda de rendimiento del 15-11-2026 (VRAM, pases GPU y shaders sin pérdida visual apreciable)

Este documento recoge las dos pasadas de optimización aplicadas el 15 de noviembre de 2026 para resolver caídas graves de rendimiento y cierres por agotamiento de VRAM manteniendo intacta la fidelidad visual.

> **Importante sobre las mediciones:** las comprobaciones en este entorno corrieron en Chromium con SwiftShader (rasterizador por CPU, sin GPU física). Las cifras de memoria, texturas, luces, render targets, llamadas de dibujo y regresiones visuales son **medidas reales** sobre el código y la escena; las ganancias de FPS esperadas en una **NVIDIA RTX 3070 (8 GB) a `3440 × 1440`** son **estimaciones arquitectónicas** pendientes de confirmar en hardware real con `npm run bench:gpu`.

---

## 1. Primera pasada (`4fd4c91`): deduplicación de texturas, cachés y CPU

1. **Deduplicación de texturas GLB (`src/geometry/utils.js`)**: `dedupTextures(root)` fusiona instancias `THREE.Texture` distintas exportadas para la misma imagen fuente e igual estado de muestreo (`gt3rsAsset.js`, `modelyAsset.js`, `h2rAsset.js`, `cybertruckLab.js`). En la escena principal redujo las texturas únicas de material de **234 a 126** y su huella estimada de **5.782,2 MB a 552,3 MB**.
2. **Caché de sombras de nubes (`src/core/clouds.js`, `src/core/environment.js`)**: hornea la cobertura `csCover` de 4 octavas en una textura `1024×1024 R16F` con histéresis de 1.920 m (respaldo exacto fuera de límites e invalidación al restaurar contexto).
3. **Ruta rápida en reposo temporal de nubes (`src/core/cloudsTemporal.js`)**: `uStill` evita reproyecciones usando `texelFetch` cuando la matriz vista-proyección no cambia.
4. **Constantes de Vogel precalculadas (`src/core/pcss.js`)**: arrays `const` en GLSL3 en lugar de trigonometría por fragmento.
5. **Descarte temprano de `SeaSSR` (`src/core/ssr.js`)**: intersección exacta del frustum con la banda del mar para apagar `pass.enabled` y omitir copias de matrices cuando no hay agua en cuadro.
6. **Antialiasing en reposo (`src/core/stillAA.js`)**: desactiva el pase en movimiento y omite el mezclado en el primer fotograma quieto.
7. **Nube de ignición y precalentamiento (`src/sim/cloudVolume.js`, `src/sim/reentry.js`, `src/main.js`)**: acota el volumen activo y el rectángulo *scissor* de raymarching en pantalla; añade precalentamiento de los materiales de `cloudVolume` y reentrada al arrancar.
8. **Sobrecarga de CPU (`src/core/ao.js`, `src/ui/hud.js`, `src/main.js`)**: eliminadas asignaciones por fotograma en `drawsDepth()`, memoización de escrituras al DOM en el HUD y salida rápida de `settleLabels()` cuando no hay etiquetas visibles.

Comparativa de imagen generada en esa pasada: [rendimiento-2026-11-15-antes-despues.png](rendimiento-2026-11-15-antes-despues.png).

---

## 2. Segunda pasada (Plan Completo Recomendado): recortes de ancho de banda, fragmentos y VRAM

### Perfil de calidad alta (`src/core/quality.js` y `src/core/clouds.js`)

| Parámetro | Antes | Después | Impacto visual y técnico |
|---|---|---|---|
| `shadowMap` | `8192` | `4096` | ¼ de píxeles y VRAM del mapa de sombras; conserva estabilidad con ajuste a rejilla de téxeles |
| `msaa` | `4` | `2` | −50 % de memoria y ancho de banda MSAA HDR; `stillAA` completa el suavizado en reposo |
| `lodPixels` | `0` | `1.5` | Solo oculta detalles subpíxel `< 1,5 px` (tornillos, interruptores, herrajes) y restaura todo al acercarse |
| `cloudSteps` | `640` | `544` | Tope de iteraciones de marcha ajustado (`dtF = clamp(t * 0.00025, 22.0, 70.0)`, `dtC = dtF * 7.5`; `p99 = 531 ≤ 544`) |

### Pases de pantalla, cachés y sondas

- **PCSS (`src/core/pcss.js`)**: `PCSS_B` `16 → 8` muestras de bloqueadores y `PCSS_P` `32 → 16` muestras de filtro de penumbra.
- **Oclusión ambiental (`src/core/ao.js`)**: GTAO `samples: 16 → 8` y filtro Poisson `rings: 2, samples: 16 → rings: 1, samples: 8`, manteniendo resolución completa (`1:1`) para evitar sangrado en bordes finos.
- **Reflejos del mar (`src/core/ssr.js`)**: marcha de `64` pasos (`×1.07`) + `6` bisecciones a `36` pasos (`×1.12`) + `4` bisecciones.
- **Cachés de sombras y G-buffer (`src/core/shadowCache.js`, `src/core/gbufferCache.js`)**: `MAX_AGE_MS` de `1000 → 5000 ms` cuando la escena sigue sin cambios de cámara, luz o geometría.
- **Sondas locales (`src/core/localProbes.js`)**: `captureOne()` cambia temporalmente las nubes de `'volume'` a `'layer'` durante la captura del cubemap y restaura en `finally`, evitando 6 marchas volumétricas completas por actualización de sonda.
- **Nube volumétrica de ignición (`src/sim/cloudVolume.js`)**: `marchTarget()` pasa a media resolución (`0.5×` ancho y alto) con `LinearFilter` y *scissor* ampliado en 1 téxel; `mediaTarget` se mantiene a resolución completa (`uSteps = 96`, bucle acotado en `320`).

### Materiales, iluminación y texturas

- **Terreno procedural (`src/materials/library.js`)**: reemplazadas 22 llamadas `vcNoise()` (88 evaluaciones `vcHash()` por fragmento) en `M.terrain` por 19 lecturas `vcN4()` sobre una `DataTexture` RGBA precalculada de `256×256` (`LinearFilter`, `RepeatWrapping`) y atenuación del microdetalle para `vcDist < 75.0` (conservando `fwidth()` fuera de ramas).
- **Detalle triplanar (`src/materials/detail.js`)**: atenuación por distancia `vDetDist` (`14–26 m`) con guarda `detFade > 0.001` para evitar muestreo triplanar cuando la microtextura es subpíxel.
- **Luces del foso (`src/vehicles/padDressing.js`)**: consolidadas las 6 `SpotLight` de `bay-inspection-lights` en 1 `SpotLight` ancha + 1 `PointLight`, manteniendo intactas las 6 luminarias físicas (`bay-lamp-heads`). Las luces activas de la escena principal bajan de **11 a 6** (`DirectionalLight`, `HemisphereLight`, `SpotLight` y 3 `PointLight`).
- **Transmisión en H2R (`src/vehicles/h2r/rearsets.js`)**: sustituida `transmission` en `M.h2rAmber` por `clearcoat: 1, transparent: true, opacity: 0.78`, eliminando el render target adicional de transmisión (`hasTransmissionRT: false`) en toda la escena principal.
- **Reescalado de mapas 4K (`src/geometry/utils.js`, `src/vehicles/modelyAsset.js`, `src/vehicles/gt3rsAsset.js`)**: añadido `downscaleTextures(root, 2048)` antes de `dedupTextures(root)` para limitar mapas horneados a `2048 px`.

### Cybertruck Lab (`src/ui/cybertruckLab.js`, `src/ui/cybertruckStudio.js`)

- **Cristales sin pase de transmisión (`glass()`)**: `transmission: 0`, `clearcoat: 1`, `transparent: true`, `depthWrite: false`, `castShadow = false`, `renderOrder = 2` (`hasTransmissionRT: false` también dentro del Lab).
- **Objetivos y texturas**: `key.shadow.mapSize` acotado a `≤ 2048`, `Reflector` de suelo a `0.5 × Math.min(dpr, 2)`, y `downscaleTextures(truck, 2048)` antes de `dedupTextures(truck)`.
- **Liberación inmediata en GPU al cerrar (`releaseGpuOnClose = true`)**: al salir del Lab se liberan geometrías y texturas GPU del modelo, se reducen `composer` y `reflector` a `1×1` y se libera `key.shadow.map`, conservando los datos en JS para reabrir al instante con **U** sin volver a descargar el `.glb`.

---

## 3. Mediciones verificadas tras los cambios

Medidas tomadas en Chromium/SwiftShader en modo `high` (`1280×800`, `dpr = 1`, `lodPixels = 1.5`):

- **Escena principal**:
  - **5.626.557** triángulos construidos; **4.246.462** dibujados en la vista general (**1.218** de **1.841** mallas, **380** materiales, **175** texturas en el contador interno de `renderer.info.memory.textures`).
  - **LOD subpíxel (`1.5 px`)**: **338 de 497** entradas subpíxel retiradas en la vista general sin cambios perceptibles; todas vuelven al acercarse.
  - **Texturas de material únicas en escena (`mainTex`)**: **123 texturas / 409,67 MB** estimados (desde **5.782,2 MB** iniciales y **552,3 MB** tras deduplicar: **−92,9 %** total).
  - **Luces activas**: **6** (antes 11).
  - **Render targets del compositor**: `stencil = false`, `samples = 2`, `hasTransmissionRT = false`.
- **Cybertruck Lab (calidad `high`)**:
  - Abierto: `227` texturas WebGL totales (+55 sobre la escena principal), `3793` geometrías, `shadowMap = 2048`, `reflector = 640×400` (`0.5×`), `hasTransmissionRT = false`.
  - Tras cerrar (**Esc**): `released = 1`, texturas **`227 → 175`**, geometrías **`3793 → 1755`**, `reflector = 1×1`, `shadowMapCleared = true`.
  - Tras reabrir (**U**): `requests = 1` (sin nueva descarga GLB), `reflector = 640×400`, `shadowMapRebuilt = true`.

### Batería de pruebas verificada

- `npm run check:static` (`eslint`, `provenance-check`, `quality-check`, `sky-clouds-check` con `p99 = 531 ≤ 544`, `render-cache-check` con `≈5048 ms`, físicas, sonido y misión): **PASA**.
- `tools/lod-pop.mjs` y `tools/lod-parts.mjs`: **PASAN** (0–1 px de cambio de 256.000 al retirar 60/124/34 piezas pequeñas a 60–400 m).
- `tools/texture-cache-check.mjs` (76 texturas / 38,9 M píxeles idénticos) y `tools/clouds-temporal-check.mjs` (error medio 0,80 niveles de gris): **PASAN**.
- `tools/check.mjs`: todas las comprobaciones de escena, medidas, LOD, cámara, lanzamiento, atmósfera, presupuesto de escena, `F-16`, winding y normales en **ok**, más verificación directa en `high` de `nan` (`control 87,6 %` / `guarded 0,017 %`), `crowd` (6 mallas, 0 sombras) y consola sin errores (en este entorno sin GPU el script completo excedía el límite de 9m50s por paso en las últimas comprobaciones).
- `tools/ux-check.mjs` y `tools/cybertruck-lab-check.mjs`: validados junto con la cola completa en GitHub Actions (`.github/workflows/pages.yml`).

---

## 4. Impacto esperado en GPU real (RTX 3070 8 GB, `3440 × 1440`)

Estimación técnica pendiente de medición directa con `npm run bench:gpu`:
- La eliminación de **> 5,3 GB** en texturas duplicadas/4K y de `transmissionRenderTarget` evita el desbordamiento de los **8 GB de VRAM** y los bloqueos por paginación a RAM del sistema (especialmente al abrir el Model Y, GT3 RS o Cybertruck Lab).
- La reducción de píxeles en sombras (`4×`), MSAA (`2×`), GTAO/PCSS/SSR (~`2×`) y shader de terreno (`vcN4`), junto con `cloudVolume` a `0.5×` en lanzamiento, debería llevar el tiempo de GPU en vistas normales por debajo del presupuesto de **60 FPS** (`< 16,6 ms`) a `3440×1440`, reduciendo además las compilaciones y picos de CPU.
