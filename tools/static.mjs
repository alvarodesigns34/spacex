/**
 * Static file handler for the headless tools.
 * The body is read before any status line, so a missing file is a clean 404
 * and never ERR_HTTP_HEADERS_SENT. /favicon.ico is empty on purpose: the page
 * ships an inline icon, and a 404 here showed up as a console error.
 */
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

export function staticHandler(root, types) {
  return async (req, res) => {
    try {
      const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
      if (rel === '/favicon.ico' || rel === 'favicon.ico' || rel.endsWith('/favicon.ico')) {
        if (!res.headersSent) res.writeHead(204);
        res.end();
        return;
      }
      const path = join(root, ['/', '\\', ''].includes(rel) ? 'index.html' : rel);
      const body = await readFile(path);
      if (res.headersSent) return;
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      if (res.headersSent) return;
      res.writeHead(404).end('not found');
    }
  };
}
