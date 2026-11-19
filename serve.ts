// SUNBURN SYNDICATE — tiny static server for local playtesting.
// Serves the game/ directory on http://localhost:8080 with no dependencies:
//   node serve.ts
// Open http://localhost:8080/ for normal play, or a staged screenshot scene
// such as http://localhost:8080/?shot=cover&seed=1

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 8080;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'game');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Resolve a request path inside game/, refusing anything that climbs out.
function resolveRequestPath(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const full = join(ROOT, clean === '/' ? 'index.html' : clean);
  if (!full.startsWith(ROOT)) return null;
  if (existsSync(full) && statSync(full).isDirectory()) return join(full, 'index.html');
  return full;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${PORT}`);
  const filePath = resolveRequestPath(url.pathname);
  if (filePath === null || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end('not found');
    return;
  }
  const body = readFileSync(filePath);
  response.writeHead(200, {
    'content-type': MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  response.end(body);
});

server.listen(PORT, () => {
  console.log(`sunburn-syndicate: serving game/ at http://localhost:${PORT}/`);
});
