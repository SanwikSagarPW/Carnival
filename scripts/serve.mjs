import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.atlas': 'text/plain', '.gz': 'application/gzip',
};

http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    if (!(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    const extension = path.extname(file);
    const gzip = /\.(html|js|mjs|css|json|svg|atlas)$/.test(file) && /gzip/.test(request.headers['accept-encoding'] || '');
    response.writeHead(200, {
      'Content-Type': types[extension] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Vary': 'Accept-Encoding',
      ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    });
    const stream = createReadStream(file);
    stream.on('error', (error) => { console.error(error); response.destroy(error); });
    if (gzip) stream.pipe(createGzip()).pipe(response);
    else stream.pipe(response);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
    if (!response.headersSent) response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end();
  }
}).listen(Number(process.env.PORT || 8000), '127.0.0.1', () => {
  console.log(`Sparky's Carnival: http://localhost:${process.env.PORT || 8000}`);
});
