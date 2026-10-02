/**
 * Static file handler for the headless tools.
 * The body is read before any status line, so a missing file is a clean 404
 * and never ERR_HTTP_HEADERS_SENT. /favicon.ico is empty on purpose: the page
 * ships an inline icon, and a 404 here showed up as a console error.
 *
 * Every path is resolved and must stay inside root: a request that would leave it (`..`,
 * encoded slashes or backslashes, an absolute or drive path) is a 403, on Linux and Windows
 * alike. Stripping a leading `../` was not enough: on Windows `/%5c..%5coutside.txt` reached a
 * file outside the tree (audit of 2 Oct 2026, H55). Symlinks inside root are followed as the
 * file system resolves them (the repository has none). Only GET and HEAD are served.
 */
import { readFile } from 'node:fs/promises';
import { extname, resolve, relative, isAbsolute, sep } from 'node:path';

/** The file a URL path names under root, or null when it would leave root or is malformed. */
export function resolveUnder(root, urlPath) {
  let p;
  try { p = decodeURIComponent((urlPath ?? '/').split('?')[0].split('#')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  // Both separators mean a separator here; a drive letter or UNC prefix is never a URL path.
  p = p.replace(/\\/g, '/');
  if (/^\/*[a-zA-Z]:/.test(p) || p.startsWith('//')) return null;
  const base = resolve(root);
  const target = resolve(base, '.' + (p.startsWith('/') ? p : '/' + p));
  const rel = relative(base, target);
  if (rel === '') return resolve(base, 'index.html');
  if (rel.startsWith('..') || isAbsolute(rel) || rel.split(sep).includes('..')) return null;
  return target;
}

export function staticHandler(root, types) {
  return async (req, res) => {
    try {
      if (req.method && req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('method not allowed'); return; }
      const path = resolveUnder(root, req.url);
      if (!path) { res.writeHead(403).end('forbidden'); return; }
      if (path.endsWith(`${sep}favicon.ico`)) {
        if (!res.headersSent) res.writeHead(204);
        res.end();
        return;
      }
      const body = await readFile(path);
      if (res.headersSent) return;
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      if (res.headersSent) return;
      res.writeHead(404).end('not found');
    }
  };
}
