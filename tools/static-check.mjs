#!/usr/bin/env node
// The headless tools' file server (tools/static.mjs) never serves outside its root: encoded
// slashes and backslashes, dot segments, drive and UNC paths, malformed escapes and NUL are
// refused, and ordinary pages still load (audit of 2 Oct 2026, H55).
import { resolveUnder } from './static.mjs';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let failed = 0;
const report = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const dir = mkdtempSync(join(tmpdir(), 'static-check-'));
const root = join(dir, 'root');
mkdirSync(join(root, 'src'), { recursive: true });
writeFileSync(join(root, 'index.html'), 'ok');
writeFileSync(join(root, 'src', 'a.js'), 'ok');
writeFileSync(join(dir, 'outside.txt'), 'secret-free fixture');

const escapes = ['/../outside.txt', '/%2e%2e/outside.txt', '/%5c..%5coutside.txt', '/..%5coutside.txt', '/src/../../outside.txt',
  '/src/%2e%2e%2f%2e%2e%2foutside.txt', '\\..\\outside.txt', '/C:/Windows/win.ini', '/c:%5cwindows', '//server/share/x', '/%E0%A4%A', '/a%00.js'];
const bad = escapes.filter(u => resolveUnder(root, u) !== null);
report(bad.length === 0, 'servidor local: ninguna ruta sale de la raíz (codificadas, barras invertidas, unidades, UNC, escapes rotos, NUL)', bad.length ? `aceptadas: ${bad.join(' ')}` : `${escapes.length} rechazadas`);
const good = [['/', 'index.html'], ['/index.html?x=1', 'index.html'], ['/src/a.js', join('src', 'a.js')], ['/src/./a.js', join('src', 'a.js')], ['/src/x/../a.js', join('src', 'a.js')]];
const wrong = good.filter(([u, f]) => resolveUnder(root, u) !== join(root, f));
report(wrong.length === 0, 'servidor local: las rutas normales siguen sirviendo sus archivos', wrong.length ? wrong.map(w => w[0]).join(' ') : `${good.length} correctas`);
process.exit(failed ? 1 : 0);
