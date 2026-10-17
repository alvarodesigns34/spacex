# Anexo: herramientas locales (no están en el repo; recréalas)

Scripts pequeños que se usaron para investigar y que no se guardaron en el repositorio: cómo eran y cómo rehacerlos. Se movió de [TRASPASO.md](../../TRASPASO.md) el 17 de octubre de 2026 sin cambiar su texto (cada título subió un nivel).

[← Índice](README.md)

**Añadidas el 04-10 (tercera sesión):** son scripts pequeños que se rehacen fácilmente.
- `_uxtail.mjs`: una copia del bloque del F-16 de `ux-check.mjs` con su arranque, para probarlo en ≈3 min. Hay que sincronizarla a mano con `ux-check`.
- `_f16snd.mjs` y `_f16wav.mjs`: extraen el WORKLET de `f16Sound.js` como hace `sound-check.mjs`, miden niveles y escriben WAV (16 bit, 48 kHz) en el scratchpad.
- `_wl.mjs`, `_xw.mjs`, `_xw2.mjs`, `_xw3.mjs` y `_gp.mjs`: vuelan `createF16Flight` y `createF16Assist` sin navegador, con viento constante o el del sitio, y escriben por consola el rumbo, la deriva y el pedal.
- **Lo que necesitan:** importar módulos de `src` con el hook de `registerHooks` de `f16-check.mjs`, que resuelve `three` y `three/addons/`.

Están excluidas en `.git/info/exclude` (`tools/_frames.mjs`, `tools/_probe.mjs`, `tools/_web.mjs`…). En un contenedor nuevo no existen: créalas con este contenido y añádelas a `.git/info/exclude`.

## `tools/_frames.mjs`: renderiza fotogramas directamente del compositor
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

## `tools/_probe.mjs`: evalúa un script en la página y devuelve el resultado en JSON
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

## `tools/_web.mjs`: navegador real para investigar
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

## `sheet.py` (en el scratchpad): hoja de contactos de una carpeta de JPG
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

## `mk.py` (en el scratchpad): encuadres en el marco del vehículo
Uso: `[HIDE='^h2r-(tank|cowl)'] python3 mk.py salida.js <expositor> nombre px py pz tx ty tz ...` y luego `node tools/_frames.mjs salida.js <carpeta>`. Antepone un encuadre `_warm` (el primero sale a menudo vacío).
```python
# usage: mk.py out.js ex name px py pz tx ty tz [fov] ...  (local frame of the exhibit's model)
import sys, json, os
HIDE = os.environ.get('HIDE', '')
out, ex = sys.argv[1], sys.argv[2]; a = sys.argv[3:]; L = []
while a:
    n, *v = a[:7]; a = a[7:]
    p, t = v[:3], v[3:6]
    L.append({'name': n, 'setup': f"""v.jump('{ex}','overview'); await new Promise(r=>setTimeout(r,4500)); v.lod.forceDetailed?.();
const m=v.exhibits['{ex}'].model; m.updateMatrixWorld(true); {('m.traverse(o=>{ if(o.isMesh && /'+HIDE+'/.test(o.name)) o.visible=false; });') if HIDE else ''}
const P=m.localToWorld(new THREE.Vector3({p[0]},{p[1]},{p[2]})), T=m.localToWorld(new THREE.Vector3({t[0]},{t[1]},{t[2]}));
v.rig.jumpTo(P,T); await new Promise(r=>setTimeout(r,1500)); v.camera.position.copy(P); v.camera.lookAt(T); v.camera.updateProjectionMatrix();"""})
json.dump([dict(L[0], name='_warm')] + L, open(out, 'w'))
```

## `ortho.py` (en el scratchpad): vista lateral derecha casi ortográfica a 1,644 mm/px
Uso: `python3 ortho.py o.js orR 0.0 0.55 [regex]`; añade tú un `_warm` delante como en `mk.py`. Plano cercano a D−1,6 m para no ver los otros expositores.
```python
# usage: ortho.py out.js name cx cy [hide-regex]  -> right-side near-orthographic frame, 1.644 mm/px at 1280x720
import sys, json, math
out, name, cx, cy = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]); hide = sys.argv[5] if len(sys.argv) > 5 else ''
D = 40.0; fov = 2 * math.degrees(math.atan(360 * 0.001644 / D))
setup = f"""v.jump('h2r','overview'); await new Promise(r=>setTimeout(r,4500)); v.lod.forceDetailed?.();
const m=v.exhibits['h2r'].model; m.updateMatrixWorld(true);
{"m.traverse(o=>{ if(o.isMesh && /"+hide+"/.test(o.name)) o.visible=false; });" if hide else ""}
const P=m.localToWorld(new THREE.Vector3({cx},{cy},{D})), T=m.localToWorld(new THREE.Vector3({cx},{cy},0));
v.rig.jumpTo(P,T); await new Promise(r=>setTimeout(r,1500)); v.camera.position.copy(P); v.camera.lookAt(T); v.camera.fov={fov}; v.camera.far=200; v.camera.near={D-1.6}; v.camera.updateProjectionMatrix();"""
json.dump([{'name': name, 'setup': setup}], open(out, 'w'))
```

## `blend.py` (en el scratchpad): foto derecha alineada sobre el render por los ejes
Uso: `python3 blend.py en/orR.jpg salida.jpg 0.5 [x0 y0 x1 y1 zoom]` (deja también `_photo.jpg`, la foto sola en el mismo encuadre).
```python
# usage: blend.py render.jpg out.jpg [alpha] [x0 y0 x1 y1 zoom]  (render's axles R(333,500) F(1215,515.1) -> photo's)
import sys
from PIL import Image
S = '<scratchpad>'
r = Image.open(sys.argv[1]).convert('RGB'); a = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
p = Image.open(S + '/ref/h/Kawasaki_Ninja_H2R_right.JPG').convert('RGB')
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0)          # photo = R1 + k (render - R0)
c0 = R1 - k * R0
w = p.transform(r.size, Image.AFFINE, (k.real, -k.imag, c0.real, k.imag, k.real, c0.imag), resample=Image.BICUBIC)
out = Image.blend(r, w, a)
if len(sys.argv) > 4:
    x0, y0, x1, y1, z = map(int, sys.argv[4:9]); out = out.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z))
    w.crop((x0, y0, x1, y1)).resize(((x1 - x0) * z, (y1 - y0) * z)).save(sys.argv[2].replace('.jpg', '_photo.jpg'))
out.save(sys.argv[2])
```

## `seg.py` (en el scratchpad): la foto derecha proyectada al plano lateral del modelo (1 px = 1 mm)
Uso: `python3 seg.py` → `en/model_mm.png` (x de −0,9 a 0,9 m, y de 0 a 1,2 m).
```python
# The right-side photograph warped into model space: 1 px = 1 mm, x from -0.9 to 0.9, y from 0 to 1.2.
import numpy as np, cv2
from PIL import Image
S = '<scratchpad>'
p = Image.open(S + '/ref/h/Kawasaki_Ninja_H2R_right.JPG').convert('RGB')
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0); c0 = R1 - k * R0
s = 0.0016441
# model (x, y) -> render (u, v) -> photo
def photo(x, y):
    r = complex(333 + (x + 0.725) / s, 500 - (y - 0.32) / s); q = c0 + k * r; return q.real, q.imag
# output pixel (i, j): x = -0.9 + i/1000, y = 1.2 - j/1000. Affine coefficients photo = A*(i,j)+b
x0, y0 = photo(-0.9, 1.2); x1, y1 = photo(-0.9 + 0.001, 1.2); x2, y2 = photo(-0.9, 1.2 - 0.001)
coef = (x1 - x0, x2 - x0, x0, y1 - y0, y2 - y0, y0)
w = p.transform((1800, 1200), Image.AFFINE, coef, resample=Image.BICUBIC)
w.save(S + '/en/model_mm.png')
print('coef', coef)
```

## `mgrid.py` (en el scratchpad): rejilla en mm del modelo sobre `model_mm.png`
Uso: `python3 mgrid.py salida.png xmin xmax ymin ymax paso_mm [escala]` (etiquetas en mm del modelo).
```python
# usage: mgrid.py out.png xmin xmax ymin ymax step_mm [scale]   (labels in model mm)
import sys
from PIL import Image, ImageDraw
S = '<scratchpad>'
im = Image.open(S + '/en/model_mm.png'); out = sys.argv[1]; xa, xb, ya, yb, st = map(int, sys.argv[2:7]); sc = float(sys.argv[7]) if len(sys.argv) > 7 else 1
c = im.crop((xa + 900, 1200 - yb, xb + 900, 1200 - ya)); c = c.resize((int(c.size[0] * sc), int(c.size[1] * sc)), Image.LANCZOS); d = ImageDraw.Draw(c)
for x in range((xa // st + 1) * st, xb, st):
    X = (x - xa) * sc; d.line((X, 0, X, c.size[1]), fill=(255, 0, 0) if x % (st * 5) == 0 else (255, 140, 140)); d.text((X + 2, 2), str(x), fill=(255, 255, 0))
for y in range((ya // st + 1) * st, yb, st):
    Y = (yb - y) * sc; d.line((0, Y, c.size[0], Y), fill=(255, 0, 0) if y % (st * 5) == 0 else (255, 140, 140)); d.text((2, Y + 2), str(y), fill=(255, 255, 0))
c.save(out)
```

## `p2m.py` (en el scratchpad): píxel de la foto derecha → mm del modelo
Uso: importar `p2m(u, v)` o `crop(cx, cy, ox, oy, zoom)` para recortes ampliados.
```python
# right.JPG pixel -> model mm (side plane)
R0, F0 = complex(333, 500), complex(1215, 515.1); R1, F1 = complex(192.5, 507.5), complex(1072.5, 542.5)
k = (F1 - R1) / (F0 - R0); c0 = R1 - k * R0; s = 0.0016441
def p2m(u, v):
    r = (complex(u, v) - c0) / k
    return round(((r.real - 333) * s - 0.725) * 1000, 1), round((0.32 - (r.imag - 500) * s) * 1000, 1)
def crop(cx, cy, ox=360, oy=380, z=4): return p2m(ox + cx / z, oy + cy / z)
if __name__ == '__main__':
    pts = {'node': (680, 290), 'fbolt': (600, 290), 'x': (420, 300), 'up': (440, 210), 'peg': (300, 400), 'pegpiv': (330, 390), 'low': (510, 450),
           'hp_tl': (100, 40), 'hp_tr': (330, 60), 'hp_r': (480, 190), 'hp_br': (470, 250), 'hp_b': (200, 230), 'hp_l': (100, 130), 'slot0': (220, 95), 'slot1': (360, 140),
           'ped0': (480, 440), 'pedtip': (650, 575), 'node2': (590, 480)}
    for n, (a, b) in pts.items(): print(n, crop(a, b))
```

## `vol.js` (en el scratchpad): mallas con volumen con signo negativo (del revés)
Uso: `node tools/_probe.mjs vol.js`. Los huecos interiores (taladro del eje, interior del silenciador) salen negativos a propósito.
```js
const { buildH2r } = await import('/src/vehicles/h2r.js');
const root = buildH2r({}), out = [];
root.updateMatrixWorld(true);
root.traverse(o => { if (!o.isMesh) return; const mats = [].concat(o.material); if (mats.every(m => m.side === THREE.DoubleSide)) return;
  const g = o.geometry, p = g.attributes.position, idx = g.index, N = idx ? idx.count : p.count; let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  g.computeBoundingBox(); const ctr = g.boundingBox.getCenter(new THREE.Vector3()), sz = g.boundingBox.getSize(new THREE.Vector3());
  for (let t = 0; t < N; t += 3) { a.fromBufferAttribute(p, idx ? idx.getX(t) : t).sub(ctr); b.fromBufferAttribute(p, idx ? idx.getX(t+1) : t+1).sub(ctr); c.fromBufferAttribute(p, idx ? idx.getX(t+2) : t+2).sub(ctr); v += a.dot(b.cross(c)) / 6; }
  const box = sz.x * sz.y * sz.z;
  if (v < 0) out.push(`${o.name} vol ${(v*1e6).toFixed(1)} cm3 (box ${(box*1e6).toFixed(0)})`);
});
return out.join('\n') || 'none negative';
```

## `empty.js` (en el scratchpad): mallas sin vértices
Uso: `node tools/_probe.mjs empty.js`.
```js
const { buildH2r } = await import('/src/vehicles/h2r.js');
const root = buildH2r({}), out = [];
root.traverse(o => { if (o.isMesh && !(o.geometry.attributes.position?.count > 0)) out.push(o.name + ' ' + Object.keys(o.geometry.attributes).join(',')); });
return out.join('\n') || 'none';
```

---

Cuando hayas leído todo, sigue la sección «Empieza aquí»: comprueba ramas, CI y Pages, y espera a que te diga qué priorizar. Si hace tiempo de la última auditoría (la del 30-09), propón repetirla con la misma lista.
