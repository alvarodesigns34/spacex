/**
 * Serves the site for local viewing, on any platform: `npm run serve` → http://127.0.0.1:8080/
 * (`--port N` for another). It used to be `python3 -m http.server`, which a Windows machine
 * without Python does not have.
 */
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { staticHandler } from './static.mjs';

const i = process.argv.indexOf('--port');
const PORT = i >= 0 ? Number(process.argv[i + 1]) : 8080;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8' };
createServer(staticHandler(fileURLToPath(new URL('..', import.meta.url)), TYPES))
  .listen(PORT, '127.0.0.1', () => console.log(`http://127.0.0.1:${PORT}/`));
