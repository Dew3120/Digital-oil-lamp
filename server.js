// Local, dependency-free server for the Digital Oil Lamp app.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = 8766;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2'
};

http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }

  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, requested);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  const type = types[path.extname(file).toLowerCase()];
  if (!type) { response.writeHead(404); response.end('Not found'); return; }

  fs.stat(file, (error, info) => {
    if (error || !info.isFile()) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`Digital Oil Lamp: http://localhost:${port}`);
  console.log('Press Ctrl+C to stop.');
});
