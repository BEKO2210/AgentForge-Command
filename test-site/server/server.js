#!/usr/bin/env node
// Minimal static server + /api/hello for the test-site demo (board #3, backend).
// Node ≥ 18 builtins only — http, fs, path, url. No npm deps.

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const STYLES_DIR = path.join(ROOT, 'styles');
const PORT = Number.parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.txt':  'text/plain; charset=utf-8',
};

const ROUTES = {
  '/':        path.join(PUBLIC_DIR, 'index.html'),
  '/about':   path.join(PUBLIC_DIR, 'about.html'),
  '/contact': path.join(PUBLIC_DIR, 'contact.html'),
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

// Resolve a request path against an allowed root, refusing traversal.
function safeResolve(rootDir, requestPath) {
  // Strip leading slash, decode, and normalize.
  let rel;
  try {
    rel = decodeURIComponent(requestPath.replace(/^\/+/, ''));
  } catch {
    return null;
  }
  if (rel.includes('\0')) return null;
  const abs = path.resolve(rootDir, rel);
  const rootWithSep = rootDir.endsWith(path.sep) ? rootDir : rootDir + path.sep;
  if (abs !== rootDir && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

function serveFile(res, absPath, method) {
  fs.stat(absPath, (err, stat) => {
    if (err || !stat.isFile()) {
      sendText(res, 404, 'Not Found');
      return;
    }
    const ext = path.extname(absPath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const headers = {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    };
    if (method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    const stream = fs.createReadStream(absPath);
    stream.on('error', () => { try { res.destroy(); } catch { /* ignore */ } });
    stream.pipe(res);
  });
}

function handle(req, res) {
  const method = req.method || 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(res, 405, 'Method Not Allowed');
    return;
  }

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  } catch {
    sendText(res, 400, 'Bad Request');
    return;
  }
  // Normalize trailing slash (except for root).
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  // API.
  if (pathname === '/api/hello') {
    sendJSON(res, 200, { message: 'hello', ts: Math.floor(Date.now() / 1000) });
    return;
  }

  // Named page routes.
  if (Object.prototype.hasOwnProperty.call(ROUTES, pathname)) {
    serveFile(res, ROUTES[pathname], method);
    return;
  }

  // Static: /styles/** from STYLES_DIR.
  if (pathname.startsWith('/styles/')) {
    const abs = safeResolve(STYLES_DIR, pathname.slice('/styles'.length));
    if (!abs) { sendText(res, 400, 'Bad Request'); return; }
    serveFile(res, abs, method);
    return;
  }

  // Static fallback: anything else under /public.
  const abs = safeResolve(PUBLIC_DIR, pathname);
  if (!abs) { sendText(res, 400, 'Bad Request'); return; }
  serveFile(res, abs, method);
}

const server = http.createServer((req, res) => {
  try {
    handle(req, res);
  } catch (err) {
    if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    else { try { res.destroy(); } catch { /* ignore */ } }
    process.stderr.write(`[test-site] handler error: ${err && err.stack || err}\n`);
  }
});

server.on('clientError', (_err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch { /* ignore */ }
});

function shutdown(signal) {
  process.stderr.write(`[test-site] received ${signal}, shutting down\n`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    process.stdout.write(`[test-site] listening on http://${HOST}:${PORT}\n`);
  });
}

module.exports = { server, handle };
