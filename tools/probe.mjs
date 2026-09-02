import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';
const ROOT='/home/user/spacex/', PORT=8802;
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=createServer(async(req,res)=>{try{const rel=normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/,'');const p=join(ROOT,rel==='/'?'index.html':rel);const b=await readFile(p);res.writeHead(200,{'Content-Type':T[extname(p)]??'application/octet-stream'});res.end(b);}catch{res.writeHead(404).end('nf');}});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const page=await(await browser.newContext({viewport:{width:800,height:600}})).newPage();
page.on('console',m=>console.log('[page]',m.text()));
await page.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'load'});
await page.waitForFunction(()=>window.__vc&&!document.getElementById('loading'),null,{timeout:120000});
console.log(JSON.stringify(await page.evaluate(()=>{
  const v=window.__vc; v.launch.seek(162);
  const su=v.env.sky.material.uniforms;
  return { alt:v.launch.state.altitude, rayleigh:su.rayleigh.value, turbidity:su.turbidity.value,
    mie:su.mieCoefficient.value, fog:v.scene.fog.density, envI:v.scene.environmentIntensity,
    hemi:v.env.hemi.intensity, skyPos:v.env.sky.position.toArray().map(Math.round),
    camPos:v.camera.position.toArray().map(Math.round), far:v.camera.far, groundScale:v.env.ground.scale.x };
}),null,1));
await browser.close(); server.close();
