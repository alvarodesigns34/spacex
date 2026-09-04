/** Screenshot helper: node shot.mjs <outdir> [shots.json]
 * shots: [{name, pos:[x,y,z], target:[x,y,z]}] or {name, jump:[id,preset]}
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = 8801;
const TYPES = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.woff2':'font/woff2' };
const server = createServer(async (req,res)=>{ try{
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/,'');
  const p = join(ROOT, (rel === '/' || rel === '\\' || rel === '') ? 'index.html' : rel);
  const b = await readFile(p);
  res.writeHead(200,{'Content-Type':TYPES[extname(p)]??'application/octet-stream'}); res.end(b);
}catch{ res.writeHead(404).end('nf'); } });
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await (await browser.newContext({ viewport:{width:1600,height:900} })).newPage();
page.on('pageerror', e=>console.log('PAGEERROR', e.message));
page.on('console', m=>{ if(m.type()==='error'){const w=`${m.text()} ${m.location()?.url??''}`; if(!/fonts\.(googleapis|gstatic)/.test(w)) console.log('CONSOLE', w);} });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil:'load' });
await page.waitForFunction(()=>window.__vc, null, { timeout:120000 });
await page.waitForFunction(()=>!document.getElementById('loading'), null, { timeout:120000 });
const outdir = process.argv[2];
const shots = JSON.parse(await readFile(process.argv[3], 'utf8'));
for (const s of shots) {
  await page.evaluate((s)=>{
    if (s.sun !== undefined) window.__vc.env.setSun(s.sun, 34);
    if (s.seek !== undefined) { window.__vc.launch.setSpeed(s.speed ?? 1); window.__vc.launch.seek(s.seek); }
    else if (s.ortho) window.__vc.ortho(s.ortho);
    else if (s.jump) window.__vc.jump(s.jump[0] ?? null, s.jump[1] ?? undefined);
    else window.__vc.rig.jumpTo(s.pos, s.target);
  }, s);
  await page.waitForTimeout(s.wait ?? 700);
  const jpg = s.name.endsWith('.jpg');
  await page.screenshot({ path: `${outdir}/${jpg ? s.name : `${s.name}.png`}`, timeout: 180000, ...(jpg ? { type: 'jpeg', quality: 88 } : {}) });
  console.log('shot', s.name);
  if (s.ortho) await page.evaluate(()=>window.__vc.ortho(null));
}
const stats = await page.evaluate(()=>{
  let tris=0, meshes=0;
  window.__vc.scene.traverse(o=>{ if(!o.isMesh||!o.visible) return; meshes++;
    const g=o.geometry, n=(g.index?g.index.count:g.attributes.position.count)/3;
    tris += n*(o.isInstancedMesh?o.count:1); });
  const t=window.__vc.renderer.info.memory;
  return { tris: Math.round(tris), meshes, geometries: t.geometries, textures: t.textures };
});
console.log(JSON.stringify(stats));
await browser.close(); server.close();
