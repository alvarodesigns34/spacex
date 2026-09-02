# SpaceX Vehicle Center

Experiencia 3D interactiva, a escala real (1 unidad = 1 metro), con recreaciones técnicas de cinco vehículos y sistemas de SpaceX:

| Vehículo | Configuración modelada | Altura / envergadura |
|---|---|---|
| Starship + Super Heavy | Versión 3 (Block 3): 33 Raptor 3, 3 grid fins, anillo hot-staging integrado | 124 m |
| Falcon 9 | Block 5 con cofia de 5,2 m, patas plegadas, grid fins de titanio | 70 m |
| Falcon Heavy | Tres núcleos, propulsores laterales con cono de morro | 70 m · 12,2 m de ancho |
| Dragon | Crew Dragon con trunk (paneles solares en media circunferencia, aletas) | 8,1 m |
| Starlink | V2 Mini con las dos alas solares desplegadas | ≈30 m de envergadura |

Todo el modelo es procedural (sin binarios): las geometrías se generan a partir de perfiles de revolución con normales analíticas y UV métricas, los materiales PBR usan texturas generadas en Canvas (acero laminado con cordones de soldadura cada 1,83 m, hollín, composite de carbono, células solares, PICA, hormigón) y el escudo térmico de Starship son ~18 000 losetas hexagonales instanciadas sobre la mitad expuesta del casco y las aletas.

## Ejecutar

Es un sitio estático con módulos ES e *import map*; Three.js r170 (núcleo + los addons usados) va incluido en `vendor/three`, así que no depende de ningún CDN. Sólo necesita un servidor HTTP:

```bash
npx serve .            # o: python3 -m http.server 8080
```

y abrir `http://localhost:3000` (o el puerto que indique). Requiere WebGL 2.

## Controles

- **Arrastrar** orbita, **rueda** acerca, **botón derecho** desplaza.
- **F** cambia a vuelo libre: `W A S D` mover, `Q`/`E` bajar/subir, arrastrar para mirar, `Shift` ×4, `Ctrl` ×0,2, rueda ajusta la velocidad.
- **1–5** selecciona vehículo, **0** vista general, **L** etiquetas, **R** regla de altura, **T** pliega la ficha, **H** ayuda.
- Deslizador **Sol** cambia la elevación solar (la iluminación, las sombras y el mapa de entorno se recalculan).

## Precisión y fuentes

Cada cifra de la ficha técnica lleva su procedencia:

- `spacex.com` — valores publicados en las páginas oficiales de cada vehículo (extraídos de las tablas de la web de SpaceX).
- `Wikipedia` — artículo del vehículo, que a su vez cita a SpaceX/NSF (altura de etapas, número de losetas, tipo de grid fins…).
- `prensa` — Spaceflight Now / SpaceNews para Starlink V2 Mini (SpaceX no publica plano).
- `derivado` — calculado a partir de las anteriores (p. ej. el tamaño de loseta a partir del recuento, o la separación entre núcleos del Falcon Heavy a partir de la anchura de 12,2 m).
- **≈** — sin valor público exacto; reconstruido a partir de imágenes. Cada vehículo lista explícitamente estos elementos en *Elementos aproximados*.

Las cifras principales usadas: Starship 124 m / 9 m, Super Heavy 72 m (3 650 t, 8 240 tf), Starship 52 m (1 600 t, 1 614 tf), Raptor 1,3 m × 2,9 m (250 tf), RVac 2,3 m × 4,4 m (275 tf); Falcon 9 70 m / 3,7 m, 549 054 kg, 9 Merlin (7 607 kN), cofia 13,1 m × 5,2 m; Falcon Heavy 70 m / 12,2 m, 27 Merlin (22 819 kN); Dragon 8,1 m / 4 m, 9,3 m³ + 37 m³, 16 Draco, 8 SuperDraco (71 kN); Starlink V2 Mini ≈4,1 m de bus, ≈800 kg, ≈30 m de envergadura, ≈116 m².

## Capturas

![Vista general del centro](docs/screenshots/overview.jpg)
![33 Raptor 3 del Super Heavy desde la plataforma](docs/screenshots/starship-engines.jpg)
![Escudo térmico de Starship: losetas hexagonales instanciadas](docs/screenshots/starship-tiles.jpg)
![Crew Dragon con trunk](docs/screenshots/dragon.jpg)
![Bus del Starlink V2 Mini](docs/screenshots/starlink-bus.jpg)

## Estructura

```
index.html                 entrada (import map de Three.js)
vendor/three/              Three.js r170 (build + addons usados)
src/main.js                escena, distribución de los vehículos, bucle de render
src/core/environment.js    cielo físico, sol, sombras dinámicas, mapa de entorno PMREM
src/core/cameraRig.js      órbita + vuelo libre + transiciones
src/geometry/utils.js      lathe con normales analíticas, ogivas, losetas instanciadas
src/materials/textures.js  texturas procedurales (Canvas 2D → mapas de color/rugosidad/normales)
src/materials/library.js   materiales PBR
src/vehicles/*.js          constructores de cada vehículo y motores instanciados
src/data/specs.js          ficha técnica con procedencia de cada dato
src/ui/hud.js              interfaz
```

## Despliegue

El flujo de GitHub Actions en `.github/workflows/pages.yml` publica el sitio en GitHub Pages (activar *Settings → Pages → Source: GitHub Actions*).
